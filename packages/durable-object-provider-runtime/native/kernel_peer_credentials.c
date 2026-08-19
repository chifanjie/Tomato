#if defined(__linux__)
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <limits.h>
#include <math.h>
#include <node_api.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#if defined(__linux__)
#include <linux/fs.h>
#include <sys/ioctl.h>
#include <sys/xattr.h>
#elif defined(__APPLE__)
#include <sys/acl.h>
#endif
#if defined(__APPLE__)
#define __APPLE_API_UNSTABLE
#include <sys/ucred.h>
#undef __APPLE_API_UNSTABLE
#endif
#include <unistd.h>

enum expected_file_kind {
  EXPECTED_FILE_KIND_DIRECTORY = 1,
  EXPECTED_FILE_KIND_REGULAR_FILE = 2,
};

static napi_value throw_coded_error(napi_env env, const char *code_text,
                                    const char *message_text) {
  napi_value code;
  napi_value error;
  napi_value message;

  if (napi_create_string_utf8(env, message_text, NAPI_AUTO_LENGTH, &message) !=
          napi_ok ||
      napi_create_error(env, NULL, message, &error) != napi_ok ||
      napi_create_string_utf8(env, code_text, NAPI_AUTO_LENGTH, &code) !=
          napi_ok ||
      napi_set_named_property(env, error, "code", code) != napi_ok) {
    napi_throw_error(env, code_text, message_text);
    return NULL;
  }

  napi_throw(env, error);
  return NULL;
}

static napi_value throw_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE",
      "kernel peer credentials are unavailable");
}

static napi_value throw_fd_access_control_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_PROVIDER_RUNTIME_NATIVE_FD_ACCESS_CONTROL_UNAVAILABLE",
      "native file-descriptor access-control admission is unavailable");
}

static int read_file_descriptor_value(napi_env env, napi_value argument,
                                      int *file_descriptor) {
  napi_valuetype argument_type;
  double numeric_value;

  if (napi_typeof(env, argument, &argument_type) != napi_ok ||
      argument_type != napi_number ||
      napi_get_value_double(env, argument, &numeric_value) != napi_ok ||
      !isfinite(numeric_value) || numeric_value < 0 ||
      numeric_value > INT_MAX || trunc(numeric_value) != numeric_value) {
    return 0;
  }

  *file_descriptor = (int)numeric_value;
  return numeric_value == (double)*file_descriptor;
}

static int read_file_descriptor(napi_env env, napi_callback_info info,
                                int *file_descriptor) {
  size_t argument_count = 1;
  napi_value argument;

  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !read_file_descriptor_value(env, argument, file_descriptor)) {
    return 0;
  }

  return 1;
}

static int read_fd_access_control_arguments(
    napi_env env, napi_callback_info info, int *file_descriptor,
    enum expected_file_kind *expected_kind) {
  size_t argument_count = 2;
  napi_value arguments[2];
  napi_valuetype kind_type;
  char kind_text[14];
  size_t kind_length = 0;

  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      !read_file_descriptor_value(env, arguments[0], file_descriptor) ||
      napi_typeof(env, arguments[1], &kind_type) != napi_ok ||
      kind_type != napi_string ||
      napi_get_value_string_utf8(env, arguments[1], kind_text,
                                 sizeof(kind_text), &kind_length) != napi_ok) {
    return 0;
  }

  if (kind_length == strlen("directory") &&
      strcmp(kind_text, "directory") == 0) {
    *expected_kind = EXPECTED_FILE_KIND_DIRECTORY;
    return 1;
  }
  if (kind_length == strlen("regular-file") &&
      strcmp(kind_text, "regular-file") == 0) {
    *expected_kind = EXPECTED_FILE_KIND_REGULAR_FILE;
    return 1;
  }
  return 0;
}

static int stat_has_expected_kind(const struct stat *metadata,
                                  enum expected_file_kind expected_kind) {
  if (expected_kind == EXPECTED_FILE_KIND_DIRECTORY) {
    return S_ISDIR(metadata->st_mode);
  }
  if (expected_kind == EXPECTED_FILE_KIND_REGULAR_FILE) {
    return S_ISREG(metadata->st_mode);
  }
  return 0;
}

static int stat_snapshot_matches(const struct stat *before,
                                 const struct stat *after) {
  if (before->st_dev != after->st_dev || before->st_ino != after->st_ino ||
      before->st_mode != after->st_mode ||
      before->st_nlink != after->st_nlink || before->st_uid != after->st_uid ||
      before->st_gid != after->st_gid || before->st_size != after->st_size) {
    return 0;
  }

#if defined(__APPLE__)
  return before->st_mtimespec.tv_sec == after->st_mtimespec.tv_sec &&
         before->st_mtimespec.tv_nsec == after->st_mtimespec.tv_nsec &&
         before->st_ctimespec.tv_sec == after->st_ctimespec.tv_sec &&
         before->st_ctimespec.tv_nsec == after->st_ctimespec.tv_nsec &&
         before->st_flags == after->st_flags;
#elif defined(__linux__)
  return before->st_mtim.tv_sec == after->st_mtim.tv_sec &&
         before->st_mtim.tv_nsec == after->st_mtim.tv_nsec &&
         before->st_ctim.tv_sec == after->st_ctim.tv_sec &&
         before->st_ctim.tv_nsec == after->st_ctim.tv_nsec;
#else
  (void)before;
  (void)after;
  return 0;
#endif
}

#if defined(__APPLE__)
static int has_no_dangerous_file_flags(const struct stat *metadata) {
  const uint32_t dangerous_flags =
      UF_IMMUTABLE | UF_APPEND | SF_IMMUTABLE | SF_APPEND;
  return (((uint32_t)metadata->st_flags) & dangerous_flags) == 0;
}

static int has_no_extended_access_control(int file_descriptor,
                                          enum expected_file_kind expected_kind) {
  acl_t access_control_list;
  acl_entry_t entry;
  int entry_identifier = ACL_FIRST_ENTRY;
  int saw_entry = 0;
  int result = 0;

  (void)expected_kind;
  errno = 0;
  access_control_list = acl_get_fd_np(file_descriptor, ACL_TYPE_EXTENDED);
  if (access_control_list == NULL) {
    return errno == ENOENT;
  }

  for (;;) {
    acl_tag_t tag_type;
    int entry_result;

    errno = 0;
    entry_result =
        acl_get_entry(access_control_list, entry_identifier, &entry);
    if (entry_result == 0) {
      saw_entry = 1;
      if (acl_get_tag_type(entry, &tag_type) != 0 ||
          tag_type != ACL_EXTENDED_DENY) {
        break;
      }
      entry_identifier = ACL_NEXT_ENTRY;
      continue;
    }
    if (entry_result == -1 && errno == EINVAL && saw_entry) {
      result = 1;
    }
    break;
  }

  if (acl_free(access_control_list) != 0) {
    result = 0;
  }
  return result;
}
#elif defined(__linux__)
#define FD_XATTR_LIST_LIMIT ((size_t)65536)

static int is_relevant_acl_xattr(const char *name,
                                 enum expected_file_kind expected_kind) {
  if (strcmp(name, "system.posix_acl_access") == 0 ||
      strcmp(name, "system.nfs4_acl") == 0 ||
      strcmp(name, "system.nfs4acl") == 0 ||
      strcmp(name, "system.richacl") == 0) {
    return 1;
  }
  return expected_kind == EXPECTED_FILE_KIND_DIRECTORY &&
         strcmp(name, "system.posix_acl_default") == 0;
}

static int has_no_extended_access_control(int file_descriptor,
                                          enum expected_file_kind expected_kind) {
  ssize_t list_size;
  ssize_t read_size;
  char *names;
  size_t offset;

  errno = 0;
  list_size = flistxattr(file_descriptor, NULL, 0);
  if (list_size < 0 || (size_t)list_size > FD_XATTR_LIST_LIMIT) {
    return 0;
  }
  if (list_size == 0) {
    return 1;
  }

  names = (char *)malloc((size_t)list_size);
  if (names == NULL) {
    return 0;
  }
  read_size = flistxattr(file_descriptor, names, (size_t)list_size);
  if (read_size != list_size) {
    free(names);
    return 0;
  }

  offset = 0;
  while (offset < (size_t)list_size) {
    size_t remaining = (size_t)list_size - offset;
    size_t name_length = strnlen(names + offset, remaining);

    if (name_length == 0 || name_length == remaining) {
      free(names);
      return 0;
    }
    if (is_relevant_acl_xattr(names + offset, expected_kind)) {
      ssize_t value_size =
          fgetxattr(file_descriptor, names + offset, NULL, 0);
      if (value_size < 0) {
        free(names);
        return 0;
      }
      free(names);
      return 0;
    }
    offset += name_length + 1;
  }

  free(names);
  return offset == (size_t)list_size;
}

static int read_linux_file_flags(int file_descriptor, unsigned int *flags) {
  int kernel_flags = 0;

  errno = 0;
  if (ioctl(file_descriptor, FS_IOC_GETFLAGS, &kernel_flags) != 0) {
    return 0;
  }
  *flags = (unsigned int)kernel_flags;
  return 1;
}

static int has_no_dangerous_file_flags(unsigned int flags) {
  return (flags & ((unsigned int)FS_IMMUTABLE_FL |
                   (unsigned int)FS_APPEND_FL)) == 0;
}
#endif

static int fd_has_no_extended_access_control(
    int file_descriptor, enum expected_file_kind expected_kind) {
  struct stat before;
  struct stat after;

  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (fstat(file_descriptor, &before) != 0 ||
      !stat_has_expected_kind(&before, expected_kind)) {
    return 0;
  }

#if defined(__APPLE__)
  if (!has_no_dangerous_file_flags(&before) ||
      !has_no_extended_access_control(file_descriptor, expected_kind) ||
      fstat(file_descriptor, &after) != 0 ||
      !has_no_dangerous_file_flags(&after)) {
    return 0;
  }
  return stat_snapshot_matches(&before, &after);
#elif defined(__linux__)
  unsigned int flags_before;
  unsigned int flags_after;

  if (!read_linux_file_flags(file_descriptor, &flags_before) ||
      !has_no_dangerous_file_flags(flags_before) ||
      !has_no_extended_access_control(file_descriptor, expected_kind) ||
      !read_linux_file_flags(file_descriptor, &flags_after) ||
      flags_before != flags_after ||
      !has_no_dangerous_file_flags(flags_after) ||
      fstat(file_descriptor, &after) != 0) {
    return 0;
  }
  return stat_snapshot_matches(&before, &after);
#else
  (void)expected_kind;
  return 0;
#endif
}

static int is_connected_unix_socket(int file_descriptor) {
  struct sockaddr_storage local_address;
  struct sockaddr_storage peer_address;
  socklen_t local_length = sizeof(local_address);
  socklen_t peer_length = sizeof(peer_address);

  memset(&local_address, 0, sizeof(local_address));
  memset(&peer_address, 0, sizeof(peer_address));
  if (getsockname(file_descriptor, (struct sockaddr *)&local_address,
                  &local_length) != 0 ||
      getpeername(file_descriptor, (struct sockaddr *)&peer_address,
                  &peer_length) != 0) {
    return 0;
  }

  return local_address.ss_family == AF_UNIX &&
         peer_address.ss_family == AF_UNIX;
}

static int read_kernel_peer_credentials(int file_descriptor, uint32_t *uid,
                                        uint32_t *gid, int64_t *pid) {
#if defined(__linux__)
  struct ucred credentials;
  socklen_t credentials_length = sizeof(credentials);

  memset(&credentials, 0, sizeof(credentials));
  if (getsockopt(file_descriptor, SOL_SOCKET, SO_PEERCRED, &credentials,
                 &credentials_length) != 0 ||
      credentials_length != sizeof(credentials) || credentials.pid <= 0) {
    return 0;
  }

  *uid = (uint32_t)credentials.uid;
  *gid = (uint32_t)credentials.gid;
  *pid = (int64_t)credentials.pid;
  return 1;
#elif defined(__APPLE__)
  uid_t peer_uid;
  gid_t peer_gid;
  struct xucred peer_credentials;
  socklen_t peer_credentials_length = sizeof(peer_credentials);
  pid_t peer_pid = 0;
  socklen_t peer_pid_length = sizeof(peer_pid);

  memset(&peer_credentials, 0, sizeof(peer_credentials));
  if (getpeereid(file_descriptor, &peer_uid, &peer_gid) != 0 ||
      getsockopt(file_descriptor, SOL_LOCAL, LOCAL_PEERCRED, &peer_credentials,
                 &peer_credentials_length) != 0 ||
      peer_credentials_length != sizeof(peer_credentials) ||
      peer_credentials.cr_version != XUCRED_VERSION ||
      peer_credentials.cr_ngroups < 1 ||
      peer_credentials.cr_ngroups > NGROUPS ||
      peer_credentials.cr_uid != peer_uid ||
      peer_credentials.cr_groups[0] != peer_gid ||
      getsockopt(file_descriptor, SOL_LOCAL, LOCAL_PEERPID, &peer_pid,
                 &peer_pid_length) != 0 ||
      peer_pid_length != sizeof(peer_pid) || peer_pid <= 0) {
    return 0;
  }

  *uid = (uint32_t)peer_uid;
  *gid = (uint32_t)peer_gid;
  *pid = (int64_t)peer_pid;
  return 1;
#else
  (void)file_descriptor;
  (void)uid;
  (void)gid;
  (void)pid;
  return 0;
#endif
}

static napi_value read_peer_credentials(napi_env env,
                                        napi_callback_info info) {
  int file_descriptor;
  uint32_t uid;
  uint32_t gid;
  int64_t pid;
  napi_value result;
  napi_value uid_value;
  napi_value gid_value;
  napi_value pid_value;

  if (!read_file_descriptor(env, info, &file_descriptor) ||
      !is_connected_unix_socket(file_descriptor) ||
      !read_kernel_peer_credentials(file_descriptor, &uid, &gid, &pid) ||
      napi_create_object(env, &result) != napi_ok ||
      napi_create_uint32(env, uid, &uid_value) != napi_ok ||
      napi_create_uint32(env, gid, &gid_value) != napi_ok ||
      napi_create_int64(env, pid, &pid_value) != napi_ok ||
      napi_set_named_property(env, result, "uid", uid_value) != napi_ok ||
      napi_set_named_property(env, result, "gid", gid_value) != napi_ok ||
      napi_set_named_property(env, result, "pid", pid_value) != napi_ok) {
    return throw_unavailable(env);
  }

  return result;
}

static napi_value assert_fd_has_no_extended_access_control(
    napi_env env, napi_callback_info info) {
  int file_descriptor;
  enum expected_file_kind expected_kind;
  napi_value result;

  if (!read_fd_access_control_arguments(env, info, &file_descriptor,
                                        &expected_kind) ||
      !fd_has_no_extended_access_control(file_descriptor, expected_kind) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_fd_access_control_unavailable(env);
  }

  return result;
}

NAPI_MODULE_INIT() {
  napi_property_descriptor descriptors[] = {
      {"readPeerCredentials", NULL, read_peer_credentials, NULL, NULL, NULL,
       napi_default, NULL},
      {"assertFdHasNoExtendedAccessControl", NULL,
       assert_fd_has_no_extended_access_control, NULL, NULL, NULL, napi_default,
       NULL},
  };

  if (napi_define_properties(env, exports,
                             sizeof(descriptors) / sizeof(descriptors[0]),
                             descriptors) != napi_ok) {
    return throw_unavailable(env);
  }
  return exports;
}
