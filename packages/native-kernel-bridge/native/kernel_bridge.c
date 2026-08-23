#if defined(__linux__)
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <math.h>
#include <node_api.h>
#include <stdbool.h>
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

#define SAFE_GIT_POINTER_LIMIT ((size_t)4096)
#define SAFE_GIT_PATH_LIMIT ((size_t)4096)
#define SAFE_GIT_BOUND_NODE_LIMIT ((size_t)128)
#define SAFE_GIT_ABSENCE_LIMIT ((size_t)4)

enum safe_git_bound_kind {
  SAFE_GIT_BOUND_DIRECTORY = 1,
  SAFE_GIT_BOUND_REGULAR_FILE = 2,
};

enum safe_git_layout {
  SAFE_GIT_LAYOUT_ORDINARY = 1,
  SAFE_GIT_LAYOUT_LINKED_WORKTREE = 2,
};

struct safe_git_bound_node {
  int file_descriptor;
  int parent_index;
  int owner_safe;
  enum safe_git_bound_kind kind;
  char component[NAME_MAX + 1];
  struct stat snapshot;
  unsigned char *expected_content;
  size_t expected_content_length;
};

struct safe_git_absence {
  int parent_index;
  char component[NAME_MAX + 1];
};

struct safe_git_descriptor_binding {
  int closed;
  enum safe_git_layout layout;
  size_t node_count;
  size_t absence_count;
  struct safe_git_bound_node nodes[SAFE_GIT_BOUND_NODE_LIMIT];
  struct safe_git_absence absences[SAFE_GIT_ABSENCE_LIMIT];
};

static const napi_type_tag SAFE_GIT_BINDING_TYPE_TAG = {
    0x8d9cf154b42e43d1ULL,
    0x96f879dd91c7af0bULL,
};

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

static napi_value throw_safe_git_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_NATIVE_KERNEL_BRIDGE_SAFE_GIT_UNAVAILABLE",
      "native SafeGit descriptor bootstrap is unavailable");
}

static int safe_git_kind_matches(const struct stat *metadata,
                                 enum safe_git_bound_kind kind) {
  if (kind == SAFE_GIT_BOUND_DIRECTORY) {
    return S_ISDIR(metadata->st_mode);
  }
  if (kind == SAFE_GIT_BOUND_REGULAR_FILE) {
    return S_ISREG(metadata->st_mode);
  }
  return 0;
}

static int safe_git_identity_matches(const struct stat *expected,
                                     const struct stat *observed,
                                     enum safe_git_bound_kind kind) {
  return safe_git_kind_matches(observed, kind) &&
         expected->st_dev == observed->st_dev &&
         expected->st_ino == observed->st_ino &&
         expected->st_uid == observed->st_uid &&
         expected->st_gid == observed->st_gid &&
         expected->st_mode == observed->st_mode;
}

static enum expected_file_kind safe_git_expected_kind(
    enum safe_git_bound_kind kind) {
  return kind == SAFE_GIT_BOUND_DIRECTORY
             ? EXPECTED_FILE_KIND_DIRECTORY
             : EXPECTED_FILE_KIND_REGULAR_FILE;
}

static int safe_git_fd_is_owner_safe(int file_descriptor,
                                     enum safe_git_bound_kind kind,
                                     const struct stat *expected) {
  struct stat after;

  memset(&after, 0, sizeof(after));
  if (!safe_git_kind_matches(expected, kind) ||
      expected->st_uid != geteuid() ||
      (((unsigned int)expected->st_mode) & 07022U) != 0U ||
      (kind == SAFE_GIT_BOUND_REGULAR_FILE && expected->st_nlink != 1) ||
      !fd_has_no_extended_access_control(file_descriptor,
                                         safe_git_expected_kind(kind)) ||
      fstat(file_descriptor, &after) != 0) {
    return 0;
  }
  if (kind == SAFE_GIT_BOUND_DIRECTORY) {
    return safe_git_identity_matches(expected, &after, kind);
  }
  return stat_snapshot_matches(expected, &after);
}

static int safe_git_component_is_valid(const char *component) {
  size_t length;

  if (component == NULL) {
    return 0;
  }
  length = strlen(component);
  return length > 0 && length <= NAME_MAX && strcmp(component, ".") != 0 &&
         strcmp(component, "..") != 0 && strchr(component, '/') == NULL;
}

static void safe_git_release_binding(
    struct safe_git_descriptor_binding *binding) {
  size_t index;

  if (binding == NULL) {
    return;
  }
  for (index = binding->node_count; index > 0; index -= 1) {
    struct safe_git_bound_node *node = &binding->nodes[index - 1];
    if (node->file_descriptor >= 0) {
      (void)close(node->file_descriptor);
      node->file_descriptor = -1;
    }
    free(node->expected_content);
    node->expected_content = NULL;
    node->expected_content_length = 0;
  }
  binding->node_count = 0;
  binding->closed = 1;
}

static void safe_git_binding_finalizer(napi_env env, void *data, void *hint) {
  struct safe_git_descriptor_binding *binding =
      (struct safe_git_descriptor_binding *)data;

  (void)env;
  (void)hint;
  safe_git_release_binding(binding);
  free(binding);
}

static int safe_git_add_node(struct safe_git_descriptor_binding *binding,
                             int file_descriptor, int parent_index,
                             const char *component,
                             enum safe_git_bound_kind kind, int owner_safe,
                             int *node_index) {
  struct safe_git_bound_node *node;
  struct stat snapshot;
  size_t component_length = component == NULL ? 0 : strlen(component);

  memset(&snapshot, 0, sizeof(snapshot));
  if (binding == NULL || binding->closed || node_index == NULL ||
      binding->node_count >= SAFE_GIT_BOUND_NODE_LIMIT ||
      parent_index < -1 ||
      (parent_index >= 0 && (size_t)parent_index >= binding->node_count) ||
      component_length > NAME_MAX || fstat(file_descriptor, &snapshot) != 0 ||
      !safe_git_kind_matches(&snapshot, kind) ||
      (owner_safe &&
       !safe_git_fd_is_owner_safe(file_descriptor, kind, &snapshot))) {
    return 0;
  }

  node = &binding->nodes[binding->node_count];
  memset(node, 0, sizeof(*node));
  node->file_descriptor = file_descriptor;
  node->parent_index = parent_index;
  node->owner_safe = owner_safe;
  node->kind = kind;
  node->snapshot = snapshot;
  if (component_length > 0) {
    memcpy(node->component, component, component_length);
  }
  node->component[component_length] = '\0';
  *node_index = (int)binding->node_count;
  binding->node_count += 1;
  return 1;
}

static int safe_git_mark_owner_safe(
    struct safe_git_descriptor_binding *binding, int node_index) {
  struct safe_git_bound_node *node;
  struct stat snapshot;

  if (binding == NULL || node_index < 0 ||
      (size_t)node_index >= binding->node_count) {
    return 0;
  }
  node = &binding->nodes[node_index];
  memset(&snapshot, 0, sizeof(snapshot));
  if (fstat(node->file_descriptor, &snapshot) != 0 ||
      !stat_snapshot_matches(&node->snapshot, &snapshot) ||
      !safe_git_fd_is_owner_safe(node->file_descriptor, node->kind,
                                 &snapshot)) {
    return 0;
  }
  node->owner_safe = 1;
  node->snapshot = snapshot;
  return 1;
}

static int safe_git_open_child(struct safe_git_descriptor_binding *binding,
                               int parent_index, const char *component,
                               enum safe_git_bound_kind kind, int owner_safe,
                               int *node_index) {
  struct stat before;
  struct stat after;
  int file_descriptor;
  int flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC;

  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (binding == NULL || parent_index < 0 ||
      (size_t)parent_index >= binding->node_count ||
      !safe_git_component_is_valid(component) ||
      fstatat(binding->nodes[parent_index].file_descriptor, component, &before,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !safe_git_kind_matches(&before, kind)) {
    return 0;
  }
  if (kind == SAFE_GIT_BOUND_DIRECTORY) {
    flags |= O_DIRECTORY;
  } else {
    flags |= O_NONBLOCK | O_NOCTTY;
  }
  file_descriptor = openat(binding->nodes[parent_index].file_descriptor,
                           component, flags);
  if (file_descriptor < 0) {
    return 0;
  }
  if (fstat(file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after) ||
      !safe_git_add_node(binding, file_descriptor, parent_index, component,
                         kind, owner_safe, node_index)) {
    (void)close(file_descriptor);
    return 0;
  }
  return 1;
}

static int safe_git_open_process_root(
    struct safe_git_descriptor_binding *binding, int *node_index) {
  int file_descriptor =
      open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (file_descriptor < 0) {
    return 0;
  }
  if (!safe_git_add_node(binding, file_descriptor, -1, "",
                         SAFE_GIT_BOUND_DIRECTORY, 0, node_index)) {
    (void)close(file_descriptor);
    return 0;
  }
  return 1;
}

static int safe_git_resolve_path(struct safe_git_descriptor_binding *binding,
                                 int base_index, const char *path,
                                 enum safe_git_bound_kind final_kind,
                                 int *node_index) {
  size_t length;
  size_t cursor;
  int current;

  if (binding == NULL || path == NULL || node_index == NULL) {
    return 0;
  }
  length = strlen(path);
  if (length == 0 || length > SAFE_GIT_PATH_LIMIT) {
    return 0;
  }
  if (path[0] == '/') {
    current = 0;
    cursor = 1;
    if (length == 1) {
      if (final_kind != SAFE_GIT_BOUND_DIRECTORY) {
        return 0;
      }
      *node_index = current;
      return 1;
    }
  } else {
    if (base_index < 0 || (size_t)base_index >= binding->node_count) {
      return 0;
    }
    current = base_index;
    cursor = 0;
  }

  while (cursor < length) {
    size_t end = cursor;
    size_t component_length;
    int is_last;
    char component[NAME_MAX + 1];

    while (end < length && path[end] != '/') {
      end += 1;
    }
    component_length = end - cursor;
    is_last = end == length;
    if (component_length == 0 || component_length > NAME_MAX) {
      return 0;
    }
    memcpy(component, path + cursor, component_length);
    component[component_length] = '\0';

    if (strcmp(component, "..") == 0) {
      if ((is_last && final_kind != SAFE_GIT_BOUND_DIRECTORY) ||
          binding->nodes[current].parent_index < 0) {
        return 0;
      }
      current = binding->nodes[current].parent_index;
    } else if (strcmp(component, ".") == 0) {
      return 0;
    } else {
      enum safe_git_bound_kind component_kind =
          is_last ? final_kind : SAFE_GIT_BOUND_DIRECTORY;
      int opened_index;
      if (!safe_git_open_child(binding, current, component, component_kind, 0,
                               &opened_index)) {
        return 0;
      }
      current = opened_index;
    }

    if (!is_last) {
      cursor = end + 1;
      if (cursor == length) {
        return 0;
      }
    } else {
      cursor = end;
    }
  }
  *node_index = current;
  return 1;
}

static int safe_git_utf8_is_valid(const unsigned char *bytes, size_t length) {
  size_t index = 0;

  while (index < length) {
    unsigned char first = bytes[index];
    size_t remaining;
    uint32_t codepoint;
    size_t offset;

    if (first <= 0x7fU) {
      index += 1;
      continue;
    }
    if (first >= 0xc2U && first <= 0xdfU) {
      remaining = 1;
      codepoint = (uint32_t)(first & 0x1fU);
    } else if (first >= 0xe0U && first <= 0xefU) {
      remaining = 2;
      codepoint = (uint32_t)(first & 0x0fU);
    } else if (first >= 0xf0U && first <= 0xf4U) {
      remaining = 3;
      codepoint = (uint32_t)(first & 0x07U);
    } else {
      return 0;
    }
    if (index + remaining >= length) {
      return 0;
    }
    for (offset = 1; offset <= remaining; offset += 1) {
      unsigned char next = bytes[index + offset];
      if ((next & 0xc0U) != 0x80U) {
        return 0;
      }
      codepoint = (codepoint << 6) | (uint32_t)(next & 0x3fU);
    }
    if ((remaining == 2 && codepoint < 0x800U) ||
        (remaining == 3 && codepoint < 0x10000U) ||
        (codepoint >= 0xd800U && codepoint <= 0xdfffU) ||
        codepoint > 0x10ffffU) {
      return 0;
    }
    index += remaining + 1;
  }
  return 1;
}

static int safe_git_pread_exact(int file_descriptor, unsigned char *bytes,
                                size_t length) {
  size_t offset = 0;

  while (offset < length) {
    ssize_t read_size =
        pread(file_descriptor, bytes + offset, length - offset, (off_t)offset);
    if (read_size < 0 && errno == EINTR) {
      continue;
    }
    if (read_size <= 0) {
      return 0;
    }
    offset += (size_t)read_size;
  }
  return 1;
}

static int safe_git_read_pointer(struct safe_git_descriptor_binding *binding,
                                 int node_index, const char *required_prefix,
                                 char output[SAFE_GIT_POINTER_LIMIT + 1]) {
  struct safe_git_bound_node *node;
  struct stat after;
  unsigned char *bytes;
  size_t length;
  size_t line_length;
  size_t prefix_length =
      required_prefix == NULL ? 0 : strlen(required_prefix);
  size_t index;

  if (binding == NULL || node_index < 0 ||
      (size_t)node_index >= binding->node_count) {
    return 0;
  }
  node = &binding->nodes[node_index];
  if (node->kind != SAFE_GIT_BOUND_REGULAR_FILE ||
      node->snapshot.st_size <= 0 ||
      (uint64_t)node->snapshot.st_size > SAFE_GIT_POINTER_LIMIT) {
    return 0;
  }
  length = (size_t)node->snapshot.st_size;
  bytes = (unsigned char *)malloc(length);
  if (bytes == NULL || !safe_git_pread_exact(node->file_descriptor, bytes, length) ||
      fstat(node->file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&node->snapshot, &after) ||
      !safe_git_utf8_is_valid(bytes, length)) {
    free(bytes);
    return 0;
  }
  line_length = length;
  if (line_length > 0 && bytes[line_length - 1] == (unsigned char)'\n') {
    line_length -= 1;
  }
  if (line_length == 0 || line_length < prefix_length) {
    free(bytes);
    return 0;
  }
  for (index = 0; index < line_length; index += 1) {
    if (bytes[index] < 0x20U || bytes[index] == 0x7fU) {
      free(bytes);
      return 0;
    }
  }
  if ((length != line_length && length != line_length + 1) ||
      (required_prefix != NULL &&
       memcmp(bytes, required_prefix, prefix_length) != 0) ||
      line_length == prefix_length) {
    free(bytes);
    return 0;
  }
  memcpy(output, bytes + prefix_length, line_length - prefix_length);
  output[line_length - prefix_length] = '\0';
  node->expected_content = bytes;
  node->expected_content_length = length;
  return 1;
}

static int safe_git_add_absence(struct safe_git_descriptor_binding *binding,
                                int parent_index, const char *component) {
  struct stat metadata;
  struct safe_git_absence *absence;
  size_t length;

  if (binding == NULL || parent_index < 0 ||
      (size_t)parent_index >= binding->node_count ||
      !safe_git_component_is_valid(component) ||
      binding->absence_count >= SAFE_GIT_ABSENCE_LIMIT) {
    return 0;
  }
  memset(&metadata, 0, sizeof(metadata));
  errno = 0;
  if (fstatat(binding->nodes[parent_index].file_descriptor, component, &metadata,
              AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) {
    return 0;
  }
  absence = &binding->absences[binding->absence_count];
  memset(absence, 0, sizeof(*absence));
  absence->parent_index = parent_index;
  length = strlen(component);
  memcpy(absence->component, component, length + 1);
  binding->absence_count += 1;
  return 1;
}

static int safe_git_nodes_are_same(
    const struct safe_git_descriptor_binding *binding, int left_index,
    int right_index) {
  const struct safe_git_bound_node *left;
  const struct safe_git_bound_node *right;

  if (binding == NULL || left_index < 0 || right_index < 0 ||
      (size_t)left_index >= binding->node_count ||
      (size_t)right_index >= binding->node_count) {
    return 0;
  }
  left = &binding->nodes[left_index];
  right = &binding->nodes[right_index];
  return left->kind == right->kind &&
         left->snapshot.st_dev == right->snapshot.st_dev &&
         left->snapshot.st_ino == right->snapshot.st_ino;
}

static int safe_git_revalidate_binding(
    struct safe_git_descriptor_binding *binding) {
  size_t index;

  if (binding == NULL || binding->closed || binding->node_count == 0) {
    return 0;
  }
  for (index = 0; index < binding->node_count; index += 1) {
    struct safe_git_bound_node *node = &binding->nodes[index];
    struct stat at_handle;

    memset(&at_handle, 0, sizeof(at_handle));
    if (fstat(node->file_descriptor, &at_handle) != 0 ||
        !safe_git_identity_matches(&node->snapshot, &at_handle, node->kind) ||
        (node->owner_safe &&
         !safe_git_fd_is_owner_safe(node->file_descriptor, node->kind,
                                    &at_handle))) {
      return 0;
    }
    if (node->parent_index >= 0) {
      struct stat at_parent;
      memset(&at_parent, 0, sizeof(at_parent));
      if (fstatat(binding->nodes[node->parent_index].file_descriptor,
                  node->component, &at_parent, AT_SYMLINK_NOFOLLOW) != 0 ||
          !safe_git_identity_matches(&node->snapshot, &at_parent, node->kind)) {
        return 0;
      }
    }
    if (node->expected_content != NULL) {
      unsigned char bytes[SAFE_GIT_POINTER_LIMIT];
      struct stat after;
      if (!safe_git_pread_exact(node->file_descriptor, bytes,
                                node->expected_content_length) ||
          memcmp(bytes, node->expected_content,
                 node->expected_content_length) != 0 ||
          fstat(node->file_descriptor, &after) != 0 ||
          !stat_snapshot_matches(&node->snapshot, &after)) {
        return 0;
      }
    }
  }
  for (index = 0; index < binding->absence_count; index += 1) {
    struct safe_git_absence *absence = &binding->absences[index];
    struct stat metadata;
    errno = 0;
    if (fstatat(binding->nodes[absence->parent_index].file_descriptor,
                absence->component, &metadata, AT_SYMLINK_NOFOLLOW) == 0 ||
        errno != ENOENT) {
      return 0;
    }
  }
  return 1;
}

static struct safe_git_descriptor_binding *safe_git_open_binding(
    const char *root_path) {
  struct safe_git_descriptor_binding *binding;
  struct stat dot_git_metadata;
  int process_root_index;
  int workspace_root_index;
  int dot_git_index;

  if (root_path == NULL || root_path[0] != '/' ||
      strlen(root_path) > SAFE_GIT_PATH_LIMIT) {
    return NULL;
  }
  binding =
      (struct safe_git_descriptor_binding *)calloc(1, sizeof(*binding));
  if (binding == NULL) {
    return NULL;
  }
  if (!safe_git_open_process_root(binding, &process_root_index) ||
      process_root_index != 0 ||
      !safe_git_resolve_path(binding, process_root_index, root_path,
                             SAFE_GIT_BOUND_DIRECTORY,
                             &workspace_root_index) ||
      workspace_root_index == process_root_index ||
      !safe_git_mark_owner_safe(binding, workspace_root_index)) {
    safe_git_release_binding(binding);
    free(binding);
    return NULL;
  }

  memset(&dot_git_metadata, 0, sizeof(dot_git_metadata));
  if (fstatat(binding->nodes[workspace_root_index].file_descriptor, ".git",
              &dot_git_metadata, AT_SYMLINK_NOFOLLOW) != 0) {
    safe_git_release_binding(binding);
    free(binding);
    return NULL;
  }
  if (S_ISDIR(dot_git_metadata.st_mode)) {
    if (!safe_git_open_child(binding, workspace_root_index, ".git",
                             SAFE_GIT_BOUND_DIRECTORY, 1, &dot_git_index) ||
        !safe_git_add_absence(binding, dot_git_index, "commondir") ||
        !safe_git_add_absence(binding, dot_git_index, "gitdir")) {
      safe_git_release_binding(binding);
      free(binding);
      return NULL;
    }
    binding->layout = SAFE_GIT_LAYOUT_ORDINARY;
  } else if (S_ISREG(dot_git_metadata.st_mode)) {
    char git_directory_path[SAFE_GIT_POINTER_LIMIT + 1];
    char common_directory_path[SAFE_GIT_POINTER_LIMIT + 1];
    char reverse_dot_git_path[SAFE_GIT_POINTER_LIMIT + 1];
    int git_directory_index;
    int common_pointer_index;
    int common_directory_index;
    int worktrees_index;
    int worktree_entry_index;
    int reverse_pointer_index;
    int reverse_dot_git_index;
    int git_directory_parent_index;

    if (!safe_git_open_child(binding, workspace_root_index, ".git",
                             SAFE_GIT_BOUND_REGULAR_FILE, 1, &dot_git_index) ||
        !safe_git_read_pointer(binding, dot_git_index, "gitdir: ",
                               git_directory_path) ||
        !safe_git_resolve_path(binding, workspace_root_index,
                               git_directory_path, SAFE_GIT_BOUND_DIRECTORY,
                               &git_directory_index) ||
        !safe_git_mark_owner_safe(binding, git_directory_index) ||
        !safe_git_open_child(binding, git_directory_index, "commondir",
                             SAFE_GIT_BOUND_REGULAR_FILE, 1,
                             &common_pointer_index) ||
        !safe_git_read_pointer(binding, common_pointer_index, NULL,
                               common_directory_path) ||
        !safe_git_resolve_path(binding, git_directory_index,
                               common_directory_path, SAFE_GIT_BOUND_DIRECTORY,
                               &common_directory_index) ||
        !safe_git_mark_owner_safe(binding, common_directory_index) ||
        !safe_git_open_child(binding, common_directory_index, "worktrees",
                             SAFE_GIT_BOUND_DIRECTORY, 1, &worktrees_index)) {
      safe_git_release_binding(binding);
      free(binding);
      return NULL;
    }
    git_directory_parent_index =
        binding->nodes[git_directory_index].parent_index;
    if (git_directory_parent_index < 0 ||
        !safe_git_nodes_are_same(binding, git_directory_parent_index,
                                 worktrees_index) ||
        !safe_git_open_child(binding, worktrees_index,
                             binding->nodes[git_directory_index].component,
                             SAFE_GIT_BOUND_DIRECTORY, 1,
                             &worktree_entry_index) ||
        !safe_git_nodes_are_same(binding, worktree_entry_index,
                                 git_directory_index) ||
        !safe_git_open_child(binding, git_directory_index, "gitdir",
                             SAFE_GIT_BOUND_REGULAR_FILE, 1,
                             &reverse_pointer_index) ||
        !safe_git_read_pointer(binding, reverse_pointer_index, NULL,
                               reverse_dot_git_path) ||
        !safe_git_resolve_path(binding, git_directory_index,
                               reverse_dot_git_path,
                               SAFE_GIT_BOUND_REGULAR_FILE,
                               &reverse_dot_git_index) ||
        !safe_git_mark_owner_safe(binding, reverse_dot_git_index) ||
        !safe_git_nodes_are_same(binding, reverse_dot_git_index,
                                 dot_git_index)) {
      safe_git_release_binding(binding);
      free(binding);
      return NULL;
    }
    binding->layout = SAFE_GIT_LAYOUT_LINKED_WORKTREE;
  } else {
    safe_git_release_binding(binding);
    free(binding);
    return NULL;
  }

  if (!safe_git_revalidate_binding(binding)) {
    safe_git_release_binding(binding);
    free(binding);
    return NULL;
  }
  return binding;
}

static int safe_git_read_root_argument(napi_env env, napi_callback_info info,
                                       char **root_path) {
  size_t argument_count = 1;
  napi_value argument;
  napi_valuetype argument_type;
  size_t length = 0;
  size_t copied = 0;
  char *buffer;

  if (root_path == NULL ||
      napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 || napi_typeof(env, argument, &argument_type) != napi_ok ||
      argument_type != napi_string ||
      napi_get_value_string_utf8(env, argument, NULL, 0, &length) != napi_ok ||
      length == 0 || length > SAFE_GIT_PATH_LIMIT) {
    return 0;
  }
  buffer = (char *)malloc(length + 1);
  if (buffer == NULL ||
      napi_get_value_string_utf8(env, argument, buffer, length + 1, &copied) !=
          napi_ok ||
      copied != length || strlen(buffer) != length) {
    free(buffer);
    return 0;
  }
  *root_path = buffer;
  return 1;
}

static const char *safe_git_layout_name(enum safe_git_layout layout) {
  if (layout == SAFE_GIT_LAYOUT_ORDINARY) {
    return "ordinary";
  }
  if (layout == SAFE_GIT_LAYOUT_LINKED_WORKTREE) {
    return "linked_worktree";
  }
  return NULL;
}

static int safe_git_create_layout_result(
    napi_env env, struct safe_git_descriptor_binding *binding,
    napi_value binding_object, napi_value *result) {
  const char *layout_name = safe_git_layout_name(binding->layout);
  napi_value layout_value;

  if (layout_name == NULL || napi_create_object(env, result) != napi_ok ||
      napi_create_string_utf8(env, layout_name, NAPI_AUTO_LENGTH,
                              &layout_value) != napi_ok ||
      napi_set_named_property(env, *result, "layout", layout_value) != napi_ok) {
    return 0;
  }
  if (binding_object != NULL &&
      napi_set_named_property(env, *result, "binding", binding_object) != napi_ok) {
    return 0;
  }
  return 1;
}

static int safe_git_unwrap_argument(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding) {
  size_t argument_count = 1;
  napi_value argument;
  bool tagged = false;

  if (binding == NULL ||
      napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      napi_check_object_type_tag(env, argument, &SAFE_GIT_BINDING_TYPE_TAG,
                                 &tagged) != napi_ok ||
      !tagged || napi_unwrap(env, argument, (void **)binding) != napi_ok ||
      *binding == NULL) {
    return 0;
  }
  return 1;
}

static napi_value open_safe_git_descriptor_bootstrap(
    napi_env env, napi_callback_info info) {
  char *root_path = NULL;
  struct safe_git_descriptor_binding *binding;
  napi_value binding_object;
  napi_value result;

  if (!safe_git_read_root_argument(env, info, &root_path)) {
    return throw_safe_git_unavailable(env);
  }
  binding = safe_git_open_binding(root_path);
  free(root_path);
  if (binding == NULL) {
    return throw_safe_git_unavailable(env);
  }
  if (napi_create_object(env, &binding_object) != napi_ok ||
      napi_wrap(env, binding_object, binding, safe_git_binding_finalizer, NULL,
                NULL) != napi_ok) {
    safe_git_release_binding(binding);
    free(binding);
    return throw_safe_git_unavailable(env);
  }
  if (napi_type_tag_object(env, binding_object, &SAFE_GIT_BINDING_TYPE_TAG) !=
          napi_ok ||
      !safe_git_create_layout_result(env, binding, binding_object, &result)) {
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value revalidate_safe_git_descriptor_bootstrap(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding;
  napi_value result;

  if (!safe_git_unwrap_argument(env, info, &binding) ||
      !safe_git_revalidate_binding(binding) ||
      !safe_git_create_layout_result(env, binding, NULL, &result)) {
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value close_safe_git_descriptor_bootstrap(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding;
  napi_value result;

  if (!safe_git_unwrap_argument(env, info, &binding)) {
    return throw_safe_git_unavailable(env);
  }
  safe_git_release_binding(binding);
  if (napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value get_kernel_bridge_profile(napi_env env,
                                            napi_callback_info info) {
  size_t argument_count = 1;
  napi_value ignored_argument;
  napi_value result;

  if (napi_get_cb_info(env, info, &argument_count, &ignored_argument, NULL,
                       NULL) != napi_ok ||
      argument_count != 0 ||
      napi_create_string_utf8(env, "native_kernel_bridge_v1", NAPI_AUTO_LENGTH,
                              &result) != napi_ok) {
    return throw_safe_git_unavailable(env);
  }
  return result;
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
      {"getKernelBridgeProfile", NULL, get_kernel_bridge_profile, NULL, NULL,
       NULL, napi_default, NULL},
      {"readPeerCredentials", NULL, read_peer_credentials, NULL, NULL, NULL,
       napi_default, NULL},
      {"assertFdHasNoExtendedAccessControl", NULL,
       assert_fd_has_no_extended_access_control, NULL, NULL, NULL, napi_default,
       NULL},
      {"openSafeGitDescriptorBootstrap", NULL,
       open_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default, NULL},
      {"revalidateSafeGitDescriptorBootstrap", NULL,
       revalidate_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default,
       NULL},
      {"closeSafeGitDescriptorBootstrap", NULL,
       close_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default,
       NULL},
  };

  if (napi_define_properties(env, exports,
                             sizeof(descriptors) / sizeof(descriptors[0]),
                             descriptors) != napi_ok) {
    return throw_unavailable(env);
  }
  return exports;
}
