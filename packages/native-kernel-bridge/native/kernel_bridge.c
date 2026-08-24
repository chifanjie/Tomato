#if defined(__linux__)
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <dirent.h>
#include <fcntl.h>
#include <limits.h>
#include <inttypes.h>
#include <math.h>
#include <node_api.h>
#include <pwd.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/file.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#include <time.h>
#if defined(__linux__)
#include <linux/fs.h>
#include <sys/ioctl.h>
#include <sys/syscall.h>
#include <sys/xattr.h>
#elif defined(__APPLE__)
#include <CoreServices/CoreServices.h>
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
#define SAFE_GIT_ABSENCE_LIMIT ((size_t)16)
#define SAFE_GIT_CONTROL_FILE_LIMIT ((size_t)16777216)
#define SAFE_GIT_CONFIG_FILE_LIMIT ((size_t)1048576)
#define SAFE_GIT_DIRECTORY_ENTRY_LIMIT ((size_t)16384)
#define SAFE_GIT_DIRECTORY_NAME_BYTES_LIMIT ((size_t)4194304)
#define SAFE_GIT_CONFIG_KEY_LIMIT ((size_t)16384)

struct safe_git_sha256_context {
  uint32_t state[8];
  uint64_t total_length;
  unsigned char buffer[64];
  size_t buffer_length;
};

static const uint32_t SAFE_GIT_SHA256_CONSTANTS[64] = {
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU,
    0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U, 0xd807aa98U, 0x12835b01U,
    0x243185beU, 0x550c7dc3U, 0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U,
    0xc19bf174U, 0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
    0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU, 0x983e5152U,
    0xa831c66dU, 0xb00327c8U, 0xbf597fc7U, 0xc6e00bf3U, 0xd5a79147U,
    0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU,
    0x53380d13U, 0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
    0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U, 0xd192e819U,
    0xd6990624U, 0xf40e3585U, 0x106aa070U, 0x19a4c116U, 0x1e376c08U,
    0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU,
    0x682e6ff3U, 0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
    0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};

static uint32_t safe_git_rotate_right(uint32_t value, uint32_t amount) {
  return (value >> amount) | (value << (32U - amount));
}

static void safe_git_sha256_transform(struct safe_git_sha256_context *context,
                                      const unsigned char block[64]) {
  uint32_t words[64];
  uint32_t a, b, c, d, e, f, g, h;
  size_t index;
  for (index = 0; index < 16; index += 1) {
    size_t offset = index * 4;
    words[index] = ((uint32_t)block[offset] << 24U) |
                   ((uint32_t)block[offset + 1] << 16U) |
                   ((uint32_t)block[offset + 2] << 8U) |
                   (uint32_t)block[offset + 3];
  }
  for (index = 16; index < 64; index += 1) {
    uint32_t left = words[index - 15];
    uint32_t right = words[index - 2];
    uint32_t s0 = safe_git_rotate_right(left, 7U) ^
                  safe_git_rotate_right(left, 18U) ^ (left >> 3U);
    uint32_t s1 = safe_git_rotate_right(right, 17U) ^
                  safe_git_rotate_right(right, 19U) ^ (right >> 10U);
    words[index] = words[index - 16] + s0 + words[index - 7] + s1;
  }
  a = context->state[0]; b = context->state[1];
  c = context->state[2]; d = context->state[3];
  e = context->state[4]; f = context->state[5];
  g = context->state[6]; h = context->state[7];
  for (index = 0; index < 64; index += 1) {
    uint32_t s1 = safe_git_rotate_right(e, 6U) ^
                  safe_git_rotate_right(e, 11U) ^
                  safe_git_rotate_right(e, 25U);
    uint32_t choose = (e & f) ^ ((~e) & g);
    uint32_t temporary1 = h + s1 + choose +
                          SAFE_GIT_SHA256_CONSTANTS[index] + words[index];
    uint32_t s0 = safe_git_rotate_right(a, 2U) ^
                  safe_git_rotate_right(a, 13U) ^
                  safe_git_rotate_right(a, 22U);
    uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temporary2 = s0 + majority;
    h = g; g = f; f = e; e = d + temporary1;
    d = c; c = b; b = a; a = temporary1 + temporary2;
  }
  context->state[0] += a; context->state[1] += b;
  context->state[2] += c; context->state[3] += d;
  context->state[4] += e; context->state[5] += f;
  context->state[6] += g; context->state[7] += h;
}

static void safe_git_sha256_init(struct safe_git_sha256_context *context) {
  static const uint32_t initial[8] = {
      0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
      0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U};
  memset(context, 0, sizeof(*context));
  memcpy(context->state, initial, sizeof(initial));
}

static void safe_git_sha256_update(struct safe_git_sha256_context *context,
                                   const unsigned char *bytes, size_t length) {
  size_t offset = 0;
  context->total_length += (uint64_t)length;
  while (offset < length) {
    size_t available = 64 - context->buffer_length;
    size_t chunk = length - offset < available ? length - offset : available;
    memcpy(context->buffer + context->buffer_length, bytes + offset, chunk);
    context->buffer_length += chunk;
    offset += chunk;
    if (context->buffer_length == 64) {
      safe_git_sha256_transform(context, context->buffer);
      context->buffer_length = 0;
    }
  }
}

static void safe_git_sha256_final(struct safe_git_sha256_context *context,
                                  unsigned char digest[32]) {
  uint64_t bit_length = context->total_length * 8U;
  size_t index;
  context->buffer[context->buffer_length++] = 0x80U;
  if (context->buffer_length > 56) {
    memset(context->buffer + context->buffer_length, 0,
           64 - context->buffer_length);
    safe_git_sha256_transform(context, context->buffer);
    context->buffer_length = 0;
  }
  memset(context->buffer + context->buffer_length, 0,
         56 - context->buffer_length);
  for (index = 0; index < 8; index += 1) {
    context->buffer[63 - index] = (unsigned char)(bit_length >> (index * 8));
  }
  safe_git_sha256_transform(context, context->buffer);
  for (index = 0; index < 8; index += 1) {
    digest[index * 4] = (unsigned char)(context->state[index] >> 24U);
    digest[index * 4 + 1] = (unsigned char)(context->state[index] >> 16U);
    digest[index * 4 + 2] = (unsigned char)(context->state[index] >> 8U);
    digest[index * 4 + 3] = (unsigned char)context->state[index];
  }
}

static void safe_git_secure_zero(void *value, size_t length) {
  volatile unsigned char *bytes = (volatile unsigned char *)value;
  while (length > 0) {
    *bytes++ = 0;
    length -= 1;
  }
}

static void safe_git_hmac_sha256(const unsigned char key[32],
                                 const unsigned char *message,
                                 size_t message_length,
                                 unsigned char digest[32]) {
  unsigned char inner_key[64];
  unsigned char outer_key[64];
  unsigned char inner_digest[32];
  struct safe_git_sha256_context context;
  size_t index;
  memset(inner_key, 0x36, sizeof(inner_key));
  memset(outer_key, 0x5c, sizeof(outer_key));
  for (index = 0; index < 32; index += 1) {
    inner_key[index] ^= key[index];
    outer_key[index] ^= key[index];
  }
  safe_git_sha256_init(&context);
  safe_git_sha256_update(&context, inner_key, sizeof(inner_key));
  safe_git_sha256_update(&context, message, message_length);
  safe_git_sha256_final(&context, inner_digest);
  safe_git_sha256_init(&context);
  safe_git_sha256_update(&context, outer_key, sizeof(outer_key));
  safe_git_sha256_update(&context, inner_digest, sizeof(inner_digest));
  safe_git_sha256_final(&context, digest);
  safe_git_secure_zero(&context, sizeof(context));
  safe_git_secure_zero(inner_key, sizeof(inner_key));
  safe_git_secure_zero(outer_key, sizeof(outer_key));
  safe_git_secure_zero(inner_digest, sizeof(inner_digest));
}

enum safe_git_bound_kind {
  SAFE_GIT_BOUND_DIRECTORY = 1,
  SAFE_GIT_BOUND_REGULAR_FILE = 2,
};

enum safe_git_layout {
  SAFE_GIT_LAYOUT_ORDINARY = 1,
  SAFE_GIT_LAYOUT_LINKED_WORKTREE = 2,
};

enum safe_git_object_format {
  SAFE_GIT_OBJECT_FORMAT_UNBOUND = 0,
  SAFE_GIT_OBJECT_FORMAT_SHA1 = 1,
  SAFE_GIT_OBJECT_FORMAT_SHA256 = 2,
};

struct safe_git_directory_entry_snapshot {
  unsigned char *name;
  size_t name_length;
  struct stat metadata;
};

struct safe_git_directory_snapshot {
  int node_index;
  size_t entry_count;
  struct safe_git_directory_entry_snapshot *entries;
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
  int workspace_root_index;
  int git_directory_index;
  int common_directory_index;
  int repository_control_bound;
  int worktree_config_present;
  enum safe_git_object_format object_format;
  size_t directory_snapshot_count;
  struct safe_git_directory_snapshot directory_snapshots[2];
};

#define INSTALLATION_AUTHORITY_NODE_LIMIT ((size_t)128)
#define INSTALLATION_IDENTITY_RECORD_LIMIT ((size_t)16384)

struct installation_authority_node {
  int file_descriptor;
  int parent_index;
  int managed;
  char component[NAME_MAX + 1];
  struct stat snapshot;
};

struct installation_artifact_pin {
  int observed;
  int present;
  struct stat snapshot;
  unsigned char content_digest[32];
};

struct installation_state_authority {
  int closed;
  size_t node_count;
  struct installation_authority_node nodes[INSTALLATION_AUTHORITY_NODE_LIMIT];
  int root_index;
  int runtime_state_index;
  int private_index;
  int provider_index;
  int acceptance_index;
  const char *resolver_id;
  char *canonical_state_root_bytes;
  char owner_identity[64];
  struct installation_artifact_pin artifact_pins[4];
};

struct installation_initialization_lock {
  int closed;
  int file_descriptor;
};

static const napi_type_tag SAFE_GIT_BINDING_TYPE_TAG = {
    0x8d9cf154b42e43d1ULL,
    0x96f879dd91c7af0bULL,
};

static const napi_type_tag INSTALLATION_AUTHORITY_TYPE_TAG = {
    0xe46190d940694cc9ULL,
    0x850260aa7cb667deULL,
};

static const napi_type_tag INSTALLATION_LOCK_TYPE_TAG = {
    0xd142bb3978a94b50ULL,
    0xa4596b4a32c23577ULL,
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

static napi_value throw_installation_state_root_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_NATIVE_KERNEL_BRIDGE_INSTALLATION_STATE_ROOT_UNAVAILABLE",
      "native installation state root is unavailable");
}

static napi_value throw_installation_state_authority_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_NATIVE_KERNEL_BRIDGE_INSTALLATION_STATE_AUTHORITY_UNAVAILABLE",
      "native installation state authority is unavailable");
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
  for (index = 0; index < binding->directory_snapshot_count; index += 1) {
    struct safe_git_directory_snapshot *snapshot =
        &binding->directory_snapshots[index];
    size_t entry_index;
    for (entry_index = 0; entry_index < snapshot->entry_count;
         entry_index += 1) {
      free(snapshot->entries[entry_index].name);
      snapshot->entries[entry_index].name = NULL;
      snapshot->entries[entry_index].name_length = 0;
    }
    free(snapshot->entries);
    snapshot->entries = NULL;
    snapshot->entry_count = 0;
    snapshot->node_index = -1;
  }
  binding->directory_snapshot_count = 0;
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
  binding->repository_control_bound = 0;
  binding->object_format = SAFE_GIT_OBJECT_FORMAT_UNBOUND;
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

static int safe_git_read_and_pin_file(
    struct safe_git_descriptor_binding *binding, int node_index,
    size_t maximum_length, int allow_empty, const unsigned char **content,
    size_t *content_length) {
  struct safe_git_bound_node *node;
  struct stat after;
  unsigned char *bytes = NULL;
  size_t length;

  if (binding == NULL || node_index < 0 ||
      (size_t)node_index >= binding->node_count || content == NULL ||
      content_length == NULL) {
    return 0;
  }
  node = &binding->nodes[node_index];
  if (node->kind != SAFE_GIT_BOUND_REGULAR_FILE || node->snapshot.st_size < 0 ||
      (uint64_t)node->snapshot.st_size > maximum_length ||
      (!allow_empty && node->snapshot.st_size == 0) ||
      node->expected_content != NULL) {
    return 0;
  }
  length = (size_t)node->snapshot.st_size;
  bytes = (unsigned char *)malloc(length == 0 ? 1 : length);
  if (bytes == NULL ||
      !safe_git_pread_exact(node->file_descriptor, bytes, length)) {
    free(bytes);
    return 0;
  }
  memset(&after, 0, sizeof(after));
  if (fstat(node->file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&node->snapshot, &after)) {
    free(bytes);
    return 0;
  }
  node->expected_content = bytes;
  node->expected_content_length = length;
  *content = bytes;
  *content_length = length;
  return 1;
}

static int safe_git_add_absence(struct safe_git_descriptor_binding *binding,
                                int parent_index, const char *component);
static int safe_git_revalidate_binding(
    struct safe_git_descriptor_binding *binding);
static int safe_git_unwrap_argument(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding);

static int safe_git_open_optional_child(
    struct safe_git_descriptor_binding *binding, int parent_index,
    const char *component, enum safe_git_bound_kind kind, int owner_safe,
    int *present, int *node_index) {
  struct stat metadata;

  if (binding == NULL || present == NULL || node_index == NULL ||
      parent_index < 0 || (size_t)parent_index >= binding->node_count ||
      !safe_git_component_is_valid(component)) {
    return 0;
  }
  memset(&metadata, 0, sizeof(metadata));
  errno = 0;
  if (fstatat(binding->nodes[parent_index].file_descriptor, component,
              &metadata, AT_SYMLINK_NOFOLLOW) != 0) {
    if (errno != ENOENT || !safe_git_add_absence(binding, parent_index,
                                                  component)) {
      return 0;
    }
    *present = 0;
    *node_index = -1;
    return 1;
  }
  if (!safe_git_kind_matches(&metadata, kind) ||
      !safe_git_open_child(binding, parent_index, component, kind, owner_safe,
                           node_index)) {
    return 0;
  }
  *present = 1;
  return 1;
}

static int safe_git_ascii_equal_case_insensitive(const unsigned char *left,
                                                 size_t left_length,
                                                 const char *right) {
  size_t index;
  size_t right_length = strlen(right);
  if (left_length != right_length) {
    return 0;
  }
  for (index = 0; index < left_length; index += 1) {
    unsigned char value = left[index];
    if (value >= (unsigned char)'A' && value <= (unsigned char)'Z') {
      value = (unsigned char)(value + ((unsigned char)'a' - (unsigned char)'A'));
    }
    if (value != (unsigned char)right[index]) {
      return 0;
    }
  }
  return 1;
}

static void safe_git_ascii_lower(unsigned char *bytes, size_t length) {
  size_t index;
  for (index = 0; index < length; index += 1) {
    if (bytes[index] >= (unsigned char)'A' &&
        bytes[index] <= (unsigned char)'Z') {
      bytes[index] = (unsigned char)(
          bytes[index] + ((unsigned char)'a' - (unsigned char)'A'));
    }
  }
}

static int safe_git_is_ascii_space(unsigned char value) {
  return value == (unsigned char)' ' || value == (unsigned char)'\t';
}

static void safe_git_trim_span(const unsigned char *bytes, size_t *start,
                               size_t *end) {
  while (*start < *end && safe_git_is_ascii_space(bytes[*start])) {
    *start += 1;
  }
  while (*end > *start && safe_git_is_ascii_space(bytes[*end - 1])) {
    *end -= 1;
  }
}

static int safe_git_config_identifier(const unsigned char *bytes,
                                      size_t length, int section) {
  size_t index;
  if (length == 0 || length > 255 ||
      !((bytes[0] >= (unsigned char)'A' && bytes[0] <= (unsigned char)'Z') ||
        (bytes[0] >= (unsigned char)'a' && bytes[0] <= (unsigned char)'z'))) {
    return 0;
  }
  for (index = 1; index < length; index += 1) {
    unsigned char value = bytes[index];
    if (!((value >= (unsigned char)'A' && value <= (unsigned char)'Z') ||
          (value >= (unsigned char)'a' && value <= (unsigned char)'z') ||
          (value >= (unsigned char)'0' && value <= (unsigned char)'9') ||
          value == (unsigned char)'-')) {
      return 0;
    }
  }
  (void)section;
  return 1;
}

static int safe_git_decode_config_value(const unsigned char *bytes,
                                        size_t length,
                                        unsigned char **decoded,
                                        size_t *decoded_length) {
  unsigned char *output;
  size_t output_length = 0;
  size_t semantic_length = 0;
  size_t index;
  int quoted = 0;

  if (decoded == NULL || decoded_length == NULL) {
    return 0;
  }
  output = (unsigned char *)malloc(length + 1);
  if (output == NULL) {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    unsigned char value = bytes[index];
    int escaped_semantic = 0;
    if (value == 0 || value == (unsigned char)'\r' ||
        value == (unsigned char)'\n') {
      free(output);
      return 0;
    }
    if (value == (unsigned char)'"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && (value == (unsigned char)'#' ||
                    value == (unsigned char)';')) {
      break;
    }
    if (value == (unsigned char)'\\') {
      unsigned char escaped;
      if (index + 1 >= length) {
        free(output);
        return 0;
      }
      escaped = bytes[++index];
      escaped_semantic = 1;
      if (escaped == (unsigned char)'n') {
        value = (unsigned char)'\n';
      } else if (escaped == (unsigned char)'t') {
        value = (unsigned char)'\t';
      } else if (escaped == (unsigned char)'b') {
        value = (unsigned char)'\b';
      } else if (escaped == (unsigned char)'\\' ||
                 escaped == (unsigned char)'"') {
        value = escaped;
      } else {
        free(output);
        return 0;
      }
    }
    output[output_length++] = value;
    if (quoted || escaped_semantic || !safe_git_is_ascii_space(value)) {
      semantic_length = output_length;
    }
  }
  if (quoted) {
    free(output);
    return 0;
  }
  output_length = semantic_length;
  output[output_length] = 0;
  *decoded = output;
  *decoded_length = output_length;
  return 1;
}

static int safe_git_config_semantic_bytes_are_valid(
    const unsigned char *bytes, size_t length) {
  size_t index;
  if (!safe_git_utf8_is_valid(bytes, length)) {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    if (bytes[index] < 0x20U || bytes[index] == 0x7fU) {
      return 0;
    }
  }
  return 1;
}

struct safe_git_config_parse_state {
  enum safe_git_object_format object_format;
  int repository_format_version;
  int repository_format_seen;
  int object_format_seen;
  int ref_storage_seen;
  int worktree_config_seen;
  int worktree_config_enabled;
  char **keys;
  size_t key_count;
};

static void safe_git_release_config_parse_state(
    struct safe_git_config_parse_state *state) {
  size_t index;
  if (state == NULL) {
    return;
  }
  for (index = 0; index < state->key_count; index += 1) {
    free(state->keys[index]);
  }
  free(state->keys);
  state->keys = NULL;
  state->key_count = 0;
}

static int safe_git_record_config_key(
    struct safe_git_config_parse_state *state, int worktree_scope,
    const unsigned char *section,
    size_t section_length, const unsigned char *subsection,
    size_t subsection_length, const unsigned char *name, size_t name_length) {
  size_t length = section_length + subsection_length + name_length + 5;
  char *key;
  char **next_keys;
  size_t index;

  if (state == NULL || state->key_count >= SAFE_GIT_CONFIG_KEY_LIMIT) {
    return 0;
  }
  key = (char *)malloc(length);
  if (key == NULL) {
    return 0;
  }
  key[0] = worktree_scope ? 'w' : 'c';
  key[1] = '\x1f';
  memcpy(key + 2, section, section_length);
  key[section_length + 2] = '\x1f';
  memcpy(key + section_length + 3, subsection, subsection_length);
  key[section_length + 3 + subsection_length] = '\x1f';
  memcpy(key + section_length + 4 + subsection_length, name, name_length);
  key[length - 1] = '\0';
  for (index = 0; index < state->key_count; index += 1) {
    if (strcmp(state->keys[index], key) == 0) {
      free(key);
      return 0;
    }
  }
  next_keys = (char **)realloc(state->keys,
                               (state->key_count + 1) * sizeof(char *));
  if (next_keys == NULL) {
    free(key);
    return 0;
  }
  state->keys = next_keys;
  state->keys[state->key_count++] = key;
  return 1;
}

static int safe_git_parse_boolean(const unsigned char *value,
                                  size_t value_length, int *result) {
  if (safe_git_ascii_equal_case_insensitive(value, value_length, "true") ||
      safe_git_ascii_equal_case_insensitive(value, value_length, "yes") ||
      safe_git_ascii_equal_case_insensitive(value, value_length, "on") ||
      (value_length == 1 && value[0] == (unsigned char)'1')) {
    *result = 1;
    return 1;
  }
  if (safe_git_ascii_equal_case_insensitive(value, value_length, "false") ||
      safe_git_ascii_equal_case_insensitive(value, value_length, "no") ||
      safe_git_ascii_equal_case_insensitive(value, value_length, "off") ||
      (value_length == 1 && value[0] == (unsigned char)'0')) {
    *result = 0;
    return 1;
  }
  return 0;
}

static int safe_git_config_key_is_allowed(
    int worktree_scope, const unsigned char *section, size_t section_length,
    size_t subsection_length, const unsigned char *name, size_t name_length) {
  if (safe_git_ascii_equal_case_insensitive(section, section_length, "core")) {
    if (subsection_length != 0) {
      return 0;
    }
    if (safe_git_ascii_equal_case_insensitive(name, name_length,
                                               "sparsecheckout") ||
        safe_git_ascii_equal_case_insensitive(name, name_length,
                                               "sparsecheckoutcone")) {
      return 1;
    }
    if (worktree_scope) {
      return 0;
    }
    return safe_git_ascii_equal_case_insensitive(
               name, name_length, "repositoryformatversion") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "filemode") ||
           safe_git_ascii_equal_case_insensitive(name, name_length, "bare") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "logallrefupdates") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "ignorecase") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "precomposeunicode") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "symlinks") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "protecthfs") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "protectntfs");
  }
  if (!worktree_scope &&
      safe_git_ascii_equal_case_insensitive(section, section_length,
                                             "extensions")) {
    if (subsection_length != 0) {
      return 0;
    }
    return safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "objectformat") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "refstorage") ||
           safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "worktreeconfig");
  }
  if (worktree_scope) {
    return 0;
  }
  if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                             "remote")) {
    return subsection_length > 0 &&
           (safe_git_ascii_equal_case_insensitive(name, name_length, "url") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "pushurl") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "fetch") ||
            safe_git_ascii_equal_case_insensitive(name, name_length, "push") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "tagopt") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "prune") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "mirror"));
  }
  if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                             "branch")) {
    return subsection_length > 0 &&
           (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "remote") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "merge") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "pushremote") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "rebase") ||
            safe_git_ascii_equal_case_insensitive(name, name_length,
                                                   "description"));
  }
  if (subsection_length != 0) {
    return 0;
  }
  if (safe_git_ascii_equal_case_insensitive(section, section_length, "user")) {
    return safe_git_ascii_equal_case_insensitive(name, name_length, "name") ||
           safe_git_ascii_equal_case_insensitive(name, name_length, "email");
  }
  if (safe_git_ascii_equal_case_insensitive(section, section_length, "init")) {
    return safe_git_ascii_equal_case_insensitive(name, name_length,
                                                  "defaultbranch");
  }
  return 0;
}

static int safe_git_nonempty_config_atom(const unsigned char *value,
                                         size_t value_length) {
  return value_length > 0 && value[0] != (unsigned char)'-';
}

static int safe_git_remote_url_is_non_executable(const unsigned char *value,
                                                 size_t value_length) {
  size_t index;
  if (!safe_git_nonempty_config_atom(value, value_length) ||
      value[0] == (unsigned char)'!') {
    return 0;
  }
  for (index = 1; index < value_length; index += 1) {
    if (value[index - 1] == (unsigned char)':' &&
        value[index] == (unsigned char)':') {
      /* Git's <transport>:: syntax dispatches a remote-helper executable. */
      return 0;
    }
  }
  return 1;
}

static int safe_git_ref_components_are_safe(const unsigned char *value,
                                            size_t value_length) {
  size_t component_start = 0;
  size_t index;
  for (index = 0; index <= value_length; index += 1) {
    if (index == value_length || value[index] == (unsigned char)'/') {
      size_t component_length = index - component_start;
      if (component_length == 0 ||
          value[component_start] == (unsigned char)'.' ||
          (component_length >= 5 &&
           memcmp(value + index - 5, ".lock", 5) == 0)) {
        return 0;
      }
      component_start = index + 1;
    }
  }
  return 1;
}

static int safe_git_branch_name_is_safe(const unsigned char *value,
                                        size_t value_length) {
  size_t index;
  if (!safe_git_nonempty_config_atom(value, value_length) ||
      value[value_length - 1] == (unsigned char)'/' ||
      value[value_length - 1] == (unsigned char)'.' ||
      !safe_git_ref_components_are_safe(value, value_length)) {
    return 0;
  }
  for (index = 0; index < value_length; index += 1) {
    unsigned char byte = value[index];
    if (byte == (unsigned char)'~' || byte == (unsigned char)'^' ||
        byte == (unsigned char)':' || byte == (unsigned char)'?' ||
        byte == (unsigned char)'*' || byte == (unsigned char)'[' ||
        byte == (unsigned char)'\\' ||
        (index > 0 && byte == (unsigned char)'/' &&
         value[index - 1] == (unsigned char)'/') ||
        (index > 0 && byte == (unsigned char)'.' &&
         value[index - 1] == (unsigned char)'.') ||
        (index > 0 && byte == (unsigned char)'{' &&
         value[index - 1] == (unsigned char)'@')) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_parse_config(
    const unsigned char *bytes, size_t length, int worktree_scope,
    struct safe_git_config_parse_state *state) {
  unsigned char section[256];
  size_t section_length = 0;
  unsigned char subsection[1025];
  size_t subsection_length = 0;
  size_t cursor = 0;

  if (state == NULL || (bytes == NULL && length != 0)) {
    return 0;
  }
  while (cursor < length) {
    size_t line_start = cursor;
    size_t line_end;
    size_t start;
    size_t end;
    size_t index;

    while (cursor < length && bytes[cursor] != (unsigned char)'\n') {
      if (bytes[cursor] == 0) {
        return 0;
      }
      cursor += 1;
    }
    line_end = cursor;
    if (cursor < length) {
      cursor += 1;
    }
    if (line_end > line_start && bytes[line_end - 1] == (unsigned char)'\r') {
      line_end -= 1;
    }
    if (line_end - line_start > 8192) {
      return 0;
    }
    start = line_start;
    end = line_end;
    safe_git_trim_span(bytes, &start, &end);
    if (start == end || bytes[start] == (unsigned char)'#' ||
        bytes[start] == (unsigned char)';') {
      continue;
    }
    if (bytes[start] == (unsigned char)'[') {
      size_t closing = end;
      size_t section_start;
      size_t section_end;
      size_t subsection_start;
      size_t subsection_end;
      int escaped = 0;

      while (closing > start && bytes[closing - 1] != (unsigned char)']') {
        closing -= 1;
      }
      if (closing <= start + 1 || bytes[closing - 1] != (unsigned char)']') {
        return 0;
      }
      for (index = closing; index < end; index += 1) {
        if (!safe_git_is_ascii_space(bytes[index]) &&
            bytes[index] != (unsigned char)'#' &&
            bytes[index] != (unsigned char)';') {
          return 0;
        }
        if (bytes[index] == (unsigned char)'#' ||
            bytes[index] == (unsigned char)';') {
          break;
        }
      }
      section_start = start + 1;
      section_end = section_start;
      while (section_end < closing - 1 &&
             !safe_git_is_ascii_space(bytes[section_end])) {
        section_end += 1;
      }
      if (!safe_git_config_identifier(bytes + section_start,
                                      section_end - section_start, 1) ||
          section_end - section_start >= sizeof(section)) {
        return 0;
      }
      section_length = section_end - section_start;
      memcpy(section, bytes + section_start, section_length);
      safe_git_ascii_lower(section, section_length);
      subsection_length = 0;
      while (section_end < closing - 1 &&
             safe_git_is_ascii_space(bytes[section_end])) {
        section_end += 1;
      }
      if (section_end < closing - 1) {
        if (bytes[section_end] != (unsigned char)'"') {
          return 0;
        }
        subsection_start = section_end + 1;
        subsection_end = subsection_start;
        while (subsection_end < closing - 1) {
          unsigned char value = bytes[subsection_end++];
          if (escaped) {
            if (value != (unsigned char)'"' && value != (unsigned char)'\\') {
              return 0;
            }
            if (subsection_length >= sizeof(subsection) - 1) {
              return 0;
            }
            subsection[subsection_length++] = value;
            escaped = 0;
          } else if (value == (unsigned char)'\\') {
            escaped = 1;
          } else if (value == (unsigned char)'"') {
            break;
          } else {
            if (value == 0 || value == (unsigned char)'\n' ||
                value == (unsigned char)'\r' ||
                subsection_length >= sizeof(subsection) - 1) {
              return 0;
            }
            subsection[subsection_length++] = value;
          }
        }
        if (escaped || subsection_end == subsection_start ||
            bytes[subsection_end - 1] != (unsigned char)'"') {
          return 0;
        }
        while (subsection_end < closing - 1 &&
               safe_git_is_ascii_space(bytes[subsection_end])) {
          subsection_end += 1;
        }
        if (subsection_end != closing - 1) {
          return 0;
        }
        if (!safe_git_config_semantic_bytes_are_valid(subsection,
                                                      subsection_length)) {
          return 0;
        }
      }
      continue;
    }

    if (section_length == 0) {
      return 0;
    }
    {
      size_t name_start = start;
      size_t name_end = name_start;
      size_t value_start;
      unsigned char name[256];
      size_t name_length;
      unsigned char *value = NULL;
      size_t value_length = 0;

      while (name_end < end && !safe_git_is_ascii_space(bytes[name_end]) &&
             bytes[name_end] != (unsigned char)'=') {
        name_end += 1;
      }
      name_length = name_end - name_start;
      if (!safe_git_config_identifier(bytes + name_start, name_length, 0) ||
          name_length >= sizeof(name)) {
        return 0;
      }
      memcpy(name, bytes + name_start, name_length);
      safe_git_ascii_lower(name, name_length);
      value_start = name_end;
      while (value_start < end && safe_git_is_ascii_space(bytes[value_start])) {
        value_start += 1;
      }
      if (value_start < end && bytes[value_start] == (unsigned char)'=') {
        value_start += 1;
        while (value_start < end && safe_git_is_ascii_space(bytes[value_start])) {
          value_start += 1;
        }
        if (!safe_git_decode_config_value(bytes + value_start,
                                          end - value_start, &value,
                                          &value_length)) {
          return 0;
        }
      } else if (value_start == end) {
        value = (unsigned char *)malloc(5);
        if (value == NULL) {
          return 0;
        }
        memcpy(value, "true", 5);
        value_length = 4;
      } else {
        return 0;
      }

      if (!safe_git_config_semantic_bytes_are_valid(value, value_length)) {
        free(value);
        return 0;
      }

      if ((safe_git_ascii_equal_case_insensitive(section, section_length,
                                                  "remote") ||
           safe_git_ascii_equal_case_insensitive(section, section_length,
                                                  "branch")) &&
          !safe_git_branch_name_is_safe(subsection, subsection_length)) {
        free(value);
        return 0;
      }

      if (!safe_git_record_config_key(state, worktree_scope, section,
                                      section_length,
                                      subsection, subsection_length, name,
                                      name_length) ||
          !safe_git_config_key_is_allowed(
              worktree_scope, section, section_length, subsection_length,
              name, name_length)) {
        free(value);
        return 0;
      }

      if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                                 "core") &&
          safe_git_ascii_equal_case_insensitive(name, name_length,
                                                 "repositoryformatversion")) {
        if (worktree_scope || state->repository_format_seen ||
            (value_length != 1 ||
             (value[0] != (unsigned char)'0' &&
              value[0] != (unsigned char)'1'))) {
          free(value);
          return 0;
        }
        state->repository_format_seen = 1;
        state->repository_format_version = value[0] - (unsigned char)'0';
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "core") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "bare")) {
        int bare;
        if (!safe_git_parse_boolean(value, value_length, &bare) || bare) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "core") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "filemode") ||
                  safe_git_ascii_equal_case_insensitive(
                      name, name_length, "logallrefupdates") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "ignorecase") ||
                  safe_git_ascii_equal_case_insensitive(
                      name, name_length, "precomposeunicode") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "symlinks") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "protecthfs") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "protectntfs") ||
                  safe_git_ascii_equal_case_insensitive(
                      name, name_length, "sparsecheckout") ||
                  safe_git_ascii_equal_case_insensitive(
                      name, name_length, "sparsecheckoutcone"))) {
        int ignored_boolean;
        if (!safe_git_parse_boolean(value, value_length, &ignored_boolean)) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                                        "extensions") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "objectformat")) {
        if (worktree_scope || state->object_format_seen) {
          free(value);
          return 0;
        }
        state->object_format_seen = 1;
        if (safe_git_ascii_equal_case_insensitive(value, value_length, "sha1")) {
          state->object_format = SAFE_GIT_OBJECT_FORMAT_SHA1;
        } else if (safe_git_ascii_equal_case_insensitive(value, value_length,
                                                          "sha256")) {
          state->object_format = SAFE_GIT_OBJECT_FORMAT_SHA256;
        } else {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                                        "extensions") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "refstorage")) {
        if (worktree_scope || state->ref_storage_seen ||
            !safe_git_ascii_equal_case_insensitive(value, value_length,
                                                    "files")) {
          free(value);
          return 0;
        }
        state->ref_storage_seen = 1;
      } else if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                                        "extensions") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "worktreeconfig")) {
        int enabled;
        if (worktree_scope || state->worktree_config_seen ||
            !safe_git_parse_boolean(value, value_length, &enabled)) {
          free(value);
          return 0;
        }
        state->worktree_config_seen = 1;
        state->worktree_config_enabled = enabled;
      } else if (safe_git_ascii_equal_case_insensitive(section, section_length,
                                                        "extensions") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "partialclone")) {
        free(value);
        return 0;
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "extensions")) {
        /* repositoryFormatVersion=1 assigns semantic authority to every
         * extension. This reader only admits its exact frozen allowlist. */
        free(value);
        return 0;
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "remote") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "url") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "pushurl"))) {
        if (!safe_git_remote_url_is_non_executable(value, value_length)) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "remote") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "fetch") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "push"))) {
        if (value_length == 0) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "remote") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "tagopt")) {
        if (!(safe_git_ascii_equal_case_insensitive(value, value_length,
                                                     "--tags") ||
              safe_git_ascii_equal_case_insensitive(value, value_length,
                                                     "--no-tags"))) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "remote") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "prune") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "mirror"))) {
        int ignored_boolean;
        if (!safe_git_parse_boolean(value, value_length, &ignored_boolean)) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "branch") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "remote") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "pushremote"))) {
        if (!safe_git_nonempty_config_atom(value, value_length) &&
            !(value_length == 1 && value[0] == (unsigned char)'.')) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "branch") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "merge")) {
        if (!safe_git_branch_name_is_safe(value, value_length) ||
            value_length < 6 || memcmp(value, "refs/", 5) != 0) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "branch") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "rebase")) {
        int ignored_boolean;
        if (!safe_git_parse_boolean(value, value_length, &ignored_boolean) &&
            !safe_git_ascii_equal_case_insensitive(value, value_length,
                                                   "merges") &&
            !safe_git_ascii_equal_case_insensitive(value, value_length,
                                                   "interactive")) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "user") &&
                 (safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "name") ||
                  safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "email"))) {
        if (value_length == 0) {
          free(value);
          return 0;
        }
      } else if (safe_git_ascii_equal_case_insensitive(
                     section, section_length, "init") &&
                 safe_git_ascii_equal_case_insensitive(name, name_length,
                                                        "defaultbranch")) {
        if (!safe_git_branch_name_is_safe(value, value_length)) {
          free(value);
          return 0;
        }
      }
      free(value);
    }
  }
  return 1;
}

static int safe_git_directory_entry_compare(const void *left_value,
                                            const void *right_value) {
  const struct safe_git_directory_entry_snapshot *left =
      (const struct safe_git_directory_entry_snapshot *)left_value;
  const struct safe_git_directory_entry_snapshot *right =
      (const struct safe_git_directory_entry_snapshot *)right_value;
  size_t shared = left->name_length < right->name_length ? left->name_length
                                                         : right->name_length;
  int compared = memcmp(left->name, right->name, shared);
  if (compared != 0) {
    return compared;
  }
  if (left->name_length < right->name_length) {
    return -1;
  }
  if (left->name_length > right->name_length) {
    return 1;
  }
  return 0;
}

static void safe_git_release_directory_snapshot(
    struct safe_git_directory_snapshot *snapshot) {
  size_t index;
  if (snapshot == NULL) {
    return;
  }
  for (index = 0; index < snapshot->entry_count; index += 1) {
    free(snapshot->entries[index].name);
  }
  free(snapshot->entries);
  snapshot->entries = NULL;
  snapshot->entry_count = 0;
  snapshot->node_index = -1;
}

static int safe_git_name_has_suffix(const unsigned char *name,
                                    size_t name_length,
                                    const char *suffix) {
  size_t suffix_length = strlen(suffix);
  return name_length >= suffix_length &&
         memcmp(name + name_length - suffix_length, suffix, suffix_length) == 0;
}

static int safe_git_is_lower_hex(unsigned char value) {
  return (value >= (unsigned char)'0' && value <= (unsigned char)'9') ||
         (value >= (unsigned char)'a' && value <= (unsigned char)'f');
}

static int safe_git_object_root_entry_is_valid(const unsigned char *name,
                                               size_t name_length,
                                               const struct stat *metadata) {
  if (!S_ISDIR(metadata->st_mode)) {
    return 0;
  }
  if ((name_length == 4 && memcmp(name, "info", 4) == 0) ||
      (name_length == 4 && memcmp(name, "pack", 4) == 0)) {
    return 1;
  }
  return name_length == 2 && safe_git_is_lower_hex(name[0]) &&
         safe_git_is_lower_hex(name[1]);
}

static int safe_git_capture_directory_snapshot(
    const struct safe_git_descriptor_binding *binding, int node_index,
    int reject_promisor, struct safe_git_directory_snapshot *snapshot) {
  struct stat before;
  struct stat after;
  DIR *directory = NULL;
  int duplicated = -1;
  size_t name_bytes = 0;
  size_t entry_capacity = 0;
  struct dirent *entry;

  if (binding == NULL || snapshot == NULL || node_index < 0 ||
      (size_t)node_index >= binding->node_count ||
      binding->nodes[node_index].kind != SAFE_GIT_BOUND_DIRECTORY) {
    return 0;
  }
  memset(snapshot, 0, sizeof(*snapshot));
  snapshot->node_index = node_index;
  memset(&before, 0, sizeof(before));
  if (fstat(binding->nodes[node_index].file_descriptor, &before) != 0) {
    return 0;
  }
  /* A duplicated fd shares the directory stream offset with the retained
   * authority. Reopen "." descriptor-relatively so every observation owns an
   * independent open-file description. */
  duplicated = openat(binding->nodes[node_index].file_descriptor, ".",
                      O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (duplicated < 0 || (directory = fdopendir(duplicated)) == NULL) {
    if (duplicated >= 0) {
      (void)close(duplicated);
    }
    return 0;
  }
  duplicated = -1;
  errno = 0;
  while ((entry = readdir(directory)) != NULL) {
    size_t name_length = strlen(entry->d_name);
    struct safe_git_directory_entry_snapshot *next_entries;
    struct safe_git_directory_entry_snapshot *candidate;
    if ((name_length == 1 && entry->d_name[0] == '.') ||
        (name_length == 2 && entry->d_name[0] == '.' &&
         entry->d_name[1] == '.')) {
      errno = 0;
      continue;
    }
    if (name_length == 0 || name_length > NAME_MAX ||
        snapshot->entry_count >= SAFE_GIT_DIRECTORY_ENTRY_LIMIT ||
        name_bytes > SAFE_GIT_DIRECTORY_NAME_BYTES_LIMIT - name_length ||
        (reject_promisor && safe_git_name_has_suffix(
                                (const unsigned char *)entry->d_name,
                                name_length, ".promisor"))) {
      (void)closedir(directory);
      safe_git_release_directory_snapshot(snapshot);
      return 0;
    }
    if (snapshot->entry_count == entry_capacity) {
      size_t next_capacity =
          entry_capacity == 0 ? 32 : entry_capacity * 2;
      if (next_capacity > SAFE_GIT_DIRECTORY_ENTRY_LIMIT) {
        next_capacity = SAFE_GIT_DIRECTORY_ENTRY_LIMIT;
      }
      if (next_capacity <= entry_capacity) {
        (void)closedir(directory);
        safe_git_release_directory_snapshot(snapshot);
        return 0;
      }
      next_entries = (struct safe_git_directory_entry_snapshot *)realloc(
          snapshot->entries,
          next_capacity *
              sizeof(struct safe_git_directory_entry_snapshot));
      if (next_entries == NULL) {
        (void)closedir(directory);
        safe_git_release_directory_snapshot(snapshot);
        return 0;
      }
      snapshot->entries = next_entries;
      entry_capacity = next_capacity;
    }
    candidate = &snapshot->entries[snapshot->entry_count];
    memset(candidate, 0, sizeof(*candidate));
    candidate->name = (unsigned char *)malloc(name_length);
    if (candidate->name == NULL ||
        fstatat(binding->nodes[node_index].file_descriptor, entry->d_name,
                &candidate->metadata, AT_SYMLINK_NOFOLLOW) != 0) {
      free(candidate->name);
      candidate->name = NULL;
      (void)closedir(directory);
      safe_git_release_directory_snapshot(snapshot);
      return 0;
    }
    if ((reject_promisor && !S_ISREG(candidate->metadata.st_mode)) ||
        (!reject_promisor &&
         !safe_git_object_root_entry_is_valid(
             (const unsigned char *)entry->d_name, name_length,
             &candidate->metadata))) {
      free(candidate->name);
      candidate->name = NULL;
      (void)closedir(directory);
      safe_git_release_directory_snapshot(snapshot);
      return 0;
    }
    memcpy(candidate->name, entry->d_name, name_length);
    candidate->name_length = name_length;
    snapshot->entry_count += 1;
    name_bytes += name_length;
    errno = 0;
  }
  if (errno != 0 || closedir(directory) != 0) {
    safe_git_release_directory_snapshot(snapshot);
    return 0;
  }
  memset(&after, 0, sizeof(after));
  if (fstat(binding->nodes[node_index].file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after)) {
    safe_git_release_directory_snapshot(snapshot);
    return 0;
  }
  qsort(snapshot->entries, snapshot->entry_count,
        sizeof(struct safe_git_directory_entry_snapshot),
        safe_git_directory_entry_compare);
  return 1;
}

static int safe_git_directory_snapshots_equal(
    const struct safe_git_directory_snapshot *left,
    const struct safe_git_directory_snapshot *right) {
  size_t index;
  if (left->node_index != right->node_index ||
      left->entry_count != right->entry_count) {
    return 0;
  }
  for (index = 0; index < left->entry_count; index += 1) {
    if (left->entries[index].name_length != right->entries[index].name_length ||
        memcmp(left->entries[index].name, right->entries[index].name,
               left->entries[index].name_length) != 0 ||
        !stat_snapshot_matches(&left->entries[index].metadata,
                               &right->entries[index].metadata)) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_ref_name_is_valid(const unsigned char *bytes,
                                      size_t length) {
  size_t index;
  if (length < 6 || memcmp(bytes, "refs/", 5) != 0 ||
      (length >= 13 && memcmp(bytes, "refs/replace/", 13) == 0) ||
      (length == 12 && memcmp(bytes, "refs/replace", 12) == 0) ||
      !safe_git_ref_components_are_safe(bytes, length) ||
      bytes[length - 1] == (unsigned char)'/' ||
      bytes[length - 1] == (unsigned char)'.') {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    unsigned char value = bytes[index];
    if (value <= 0x20U || value == 0x7fU || value == (unsigned char)'~' ||
        value == (unsigned char)'^' || value == (unsigned char)':' ||
        value == (unsigned char)'?' || value == (unsigned char)'*' ||
        value == (unsigned char)'[' || value == (unsigned char)'\\' ||
        (index > 0 && value == (unsigned char)'/' &&
         bytes[index - 1] == (unsigned char)'/') ||
        (index > 0 && value == (unsigned char)'.' &&
         bytes[index - 1] == (unsigned char)'.') ||
        (index > 0 && value == (unsigned char)'{' &&
         bytes[index - 1] == (unsigned char)'@')) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_oid_bytes_are_valid(const unsigned char *bytes,
                                        size_t length,
                                        enum safe_git_object_format format) {
  size_t expected = format == SAFE_GIT_OBJECT_FORMAT_SHA256 ? 64 : 40;
  size_t index;
  if (length != expected) {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    unsigned char value = bytes[index];
    if (!((value >= (unsigned char)'0' && value <= (unsigned char)'9') ||
          (value >= (unsigned char)'a' && value <= (unsigned char)'f'))) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_validate_packed_refs(
    const unsigned char *bytes, size_t length,
    enum safe_git_object_format object_format) {
  size_t cursor = 0;
  const unsigned char *previous_ref = NULL;
  size_t previous_ref_length = 0;
  int prior_ref = 0;
  if (length == 0 || bytes == NULL || bytes[length - 1] != (unsigned char)'\n') {
    return 0;
  }
  while (cursor < length) {
    size_t start = cursor;
    size_t end;
    while (cursor < length && bytes[cursor] != (unsigned char)'\n') {
      if (bytes[cursor] == 0 || bytes[cursor] == (unsigned char)'\r') {
        return 0;
      }
      cursor += 1;
    }
    end = cursor;
    cursor += 1;
    if (end == start) {
      return 0;
    }
    if (bytes[start] == (unsigned char)'#') {
      prior_ref = 0;
      continue;
    }
    if (bytes[start] == (unsigned char)'^') {
      if (!prior_ref || !safe_git_oid_bytes_are_valid(
                            bytes + start + 1, end - start - 1,
                            object_format)) {
        return 0;
      }
      prior_ref = 0;
      continue;
    }
    {
      size_t separator = start;
      while (separator < end && bytes[separator] != (unsigned char)' ') {
        separator += 1;
      }
      if (separator == end ||
          !safe_git_oid_bytes_are_valid(bytes + start, separator - start,
                                        object_format) ||
          !safe_git_ref_name_is_valid(bytes + separator + 1,
                                      end - separator - 1)) {
        return 0;
      }
      {
        const unsigned char *current_ref = bytes + separator + 1;
        size_t current_ref_length = end - separator - 1;
        if (previous_ref != NULL) {
          size_t shared = previous_ref_length < current_ref_length
                              ? previous_ref_length
                              : current_ref_length;
          int order = memcmp(previous_ref, current_ref, shared);
          if (order > 0 ||
              (order == 0 && previous_ref_length >= current_ref_length)) {
            return 0;
          }
        }
        previous_ref = current_ref;
        previous_ref_length = current_ref_length;
      }
      prior_ref = 1;
    }
  }
  return 1;
}

static int safe_git_bind_repository_control(
    struct safe_git_descriptor_binding *binding) {
  struct safe_git_config_parse_state config_state;
  const unsigned char *repository_config_bytes = NULL;
  size_t repository_config_length = 0;
  int repository_config_index;
  int worktree_config_present;
  int worktree_config_index;
  int objects_index;
  int objects_info_index;
  int objects_pack_index;
  int common_info_index;
  int refs_index;
  int packed_refs_present;
  int packed_refs_index;
  int product_namespace_present;
  int product_namespace_index;
  int ignored_index;
  int ignored_present;
  const unsigned char *packed_refs_bytes = NULL;
  size_t packed_refs_length = 0;

  if (binding == NULL || binding->closed ||
      binding->workspace_root_index < 0 || binding->git_directory_index < 0 ||
      binding->common_directory_index < 0 ||
      !safe_git_revalidate_binding(binding)) {
    return 0;
  }
  if (binding->repository_control_bound) {
    return binding->directory_snapshot_count == 2 &&
           safe_git_revalidate_binding(binding);
  }
  /* Promotion is single-shot. A non-zero partial snapshot count can only be
   * the residue of an interrupted promotion and must never be indexed again. */
  if (binding->directory_snapshot_count != 0) {
    return 0;
  }
  memset(&config_state, 0, sizeof(config_state));
  config_state.object_format = SAFE_GIT_OBJECT_FORMAT_SHA1;
  config_state.repository_format_version = 0;

  if (!safe_git_open_child(binding, binding->common_directory_index, "config",
                           SAFE_GIT_BOUND_REGULAR_FILE, 1,
                           &repository_config_index) ||
      !safe_git_read_and_pin_file(binding, repository_config_index,
                                  SAFE_GIT_CONFIG_FILE_LIMIT, 0,
                                  &repository_config_bytes,
                                  &repository_config_length) ||
      !safe_git_parse_config(repository_config_bytes, repository_config_length,
                             0, &config_state) ||
      ((config_state.object_format_seen || config_state.ref_storage_seen ||
        config_state.worktree_config_seen) &&
       config_state.repository_format_version != 1)) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }

  if (!safe_git_open_optional_child(
          binding, binding->git_directory_index, "config.worktree",
          SAFE_GIT_BOUND_REGULAR_FILE, 1, &worktree_config_present,
          &worktree_config_index)) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }
  if (worktree_config_present) {
    const unsigned char *worktree_config_bytes = NULL;
    size_t worktree_config_length = 0;
    if (!config_state.worktree_config_enabled ||
        !safe_git_read_and_pin_file(binding, worktree_config_index,
                                    SAFE_GIT_CONFIG_FILE_LIMIT, 1,
                                    &worktree_config_bytes,
                                    &worktree_config_length) ||
        !safe_git_parse_config(worktree_config_bytes, worktree_config_length,
                               1, &config_state)) {
      safe_git_release_config_parse_state(&config_state);
      return 0;
    }
  }

  if (!safe_git_open_child(binding, binding->common_directory_index, "objects",
                           SAFE_GIT_BOUND_DIRECTORY, 1, &objects_index) ||
      !safe_git_open_child(binding, objects_index, "info",
                           SAFE_GIT_BOUND_DIRECTORY, 1,
                           &objects_info_index) ||
      !safe_git_open_child(binding, objects_index, "pack",
                           SAFE_GIT_BOUND_DIRECTORY, 1,
                           &objects_pack_index) ||
      !safe_git_add_absence(binding, objects_info_index, "alternates") ||
      !safe_git_add_absence(binding, objects_info_index, "http-alternates") ||
      !safe_git_open_child(binding, binding->common_directory_index, "info",
                           SAFE_GIT_BOUND_DIRECTORY, 1, &common_info_index) ||
      !safe_git_add_absence(binding, common_info_index, "grafts") ||
      !safe_git_open_child(binding, binding->common_directory_index, "refs",
                           SAFE_GIT_BOUND_DIRECTORY, 1, &refs_index) ||
      !safe_git_add_absence(binding, refs_index, "replace") ||
      !safe_git_add_absence(binding, binding->common_directory_index,
                            "reftable") ||
      !safe_git_add_absence(binding, binding->common_directory_index,
                            "reftable-list") ||
      !safe_git_open_optional_child(
          binding, binding->common_directory_index, "packed-refs",
          SAFE_GIT_BOUND_REGULAR_FILE, 1, &packed_refs_present,
          &packed_refs_index) ||
      !safe_git_open_optional_child(
          binding, refs_index, "understand-code", SAFE_GIT_BOUND_DIRECTORY, 1,
          &product_namespace_present, &product_namespace_index)) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }
  (void)product_namespace_present;
  (void)product_namespace_index;

  if (packed_refs_present &&
      (!safe_git_read_and_pin_file(binding, packed_refs_index,
                                   SAFE_GIT_CONTROL_FILE_LIMIT, 0,
                                   &packed_refs_bytes, &packed_refs_length) ||
       !safe_git_validate_packed_refs(packed_refs_bytes, packed_refs_length,
                                     config_state.object_format))) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }

  /* Reject repository-level partial clone markers independent of config. */
  if (!safe_git_open_optional_child(
          binding, binding->common_directory_index, "shallow",
          SAFE_GIT_BOUND_REGULAR_FILE, 1, &ignored_present, &ignored_index)) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }
  if (ignored_present) {
    /* A shallow repository is not a complete local object database. */
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }

  if (!safe_git_capture_directory_snapshot(
          binding, objects_index, 0,
          &binding->directory_snapshots[binding->directory_snapshot_count]) ) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }
  binding->directory_snapshot_count += 1;
  if (!safe_git_capture_directory_snapshot(
          binding, objects_pack_index, 1,
          &binding->directory_snapshots[binding->directory_snapshot_count])) {
    safe_git_release_config_parse_state(&config_state);
    return 0;
  }
  binding->directory_snapshot_count += 1;
  binding->object_format = config_state.object_format;
  binding->worktree_config_present = worktree_config_present;
  binding->repository_control_bound = 1;
  safe_git_release_config_parse_state(&config_state);
  return safe_git_revalidate_binding(binding);
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
      unsigned char *bytes = NULL;
      struct stat after;
      bytes = (unsigned char *)malloc(
          node->expected_content_length == 0 ? 1
                                             : node->expected_content_length);
      if (bytes == NULL ||
          !safe_git_pread_exact(node->file_descriptor, bytes,
                                node->expected_content_length) ||
          memcmp(bytes, node->expected_content,
                 node->expected_content_length) != 0 ||
          fstat(node->file_descriptor, &after) != 0 ||
          !stat_snapshot_matches(&node->snapshot, &after)) {
        free(bytes);
        return 0;
      }
      free(bytes);
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
  for (index = 0; index < binding->directory_snapshot_count; index += 1) {
    struct safe_git_directory_snapshot observed;
    int reject_promisor = index == 1;
    if (!safe_git_capture_directory_snapshot(
            binding, binding->directory_snapshots[index].node_index,
            reject_promisor, &observed)) {
      return 0;
    }
    if (!safe_git_directory_snapshots_equal(
            &binding->directory_snapshots[index], &observed)) {
      safe_git_release_directory_snapshot(&observed);
      return 0;
    }
    safe_git_release_directory_snapshot(&observed);
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
  binding->workspace_root_index = -1;
  binding->git_directory_index = -1;
  binding->common_directory_index = -1;
  binding->object_format = SAFE_GIT_OBJECT_FORMAT_UNBOUND;
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
    binding->git_directory_index = dot_git_index;
    binding->common_directory_index = dot_git_index;
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
    binding->git_directory_index = git_directory_index;
    binding->common_directory_index = common_directory_index;
  } else {
    safe_git_release_binding(binding);
    free(binding);
    return NULL;
  }

  binding->workspace_root_index = workspace_root_index;

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

static int safe_git_set_string_property(napi_env env, napi_value object,
                                        const char *name,
                                        const char *value_text) {
  napi_value value;
  return napi_create_string_utf8(env, value_text, NAPI_AUTO_LENGTH, &value) ==
             napi_ok &&
         napi_set_named_property(env, object, name, value) == napi_ok;
}

static int installation_account_home(char home[SAFE_GIT_PATH_LIMIT + 1],
                                     uid_t *resolved_uid,
                                     gid_t *resolved_gid) {
  uid_t effective_uid = geteuid();
  long configured_size = sysconf(_SC_GETPW_R_SIZE_MAX);
  size_t buffer_size =
      configured_size > 0 && configured_size <= 1048576L
          ? (size_t)configured_size
          : (size_t)16384;
  char *buffer = (char *)malloc(buffer_size);
  struct passwd account;
  struct passwd *result = NULL;
  size_t home_length;
  int status;
  if (buffer == NULL || resolved_uid == NULL || resolved_gid == NULL) {
    free(buffer);
    return 0;
  }
  memset(&account, 0, sizeof(account));
  status = getpwuid_r(effective_uid, &account, buffer, buffer_size, &result);
  if (status != 0 || result == NULL || result != &account ||
      account.pw_uid != effective_uid || account.pw_dir == NULL ||
      account.pw_dir[0] != '/' || account.pw_gid != getegid()) {
    safe_git_secure_zero(buffer, buffer_size);
    free(buffer);
    return 0;
  }
  home_length = strlen(account.pw_dir);
  if (home_length == 0 || home_length > SAFE_GIT_PATH_LIMIT ||
      (home_length > 1 && account.pw_dir[home_length - 1] == '/')) {
    safe_git_secure_zero(buffer, buffer_size);
    free(buffer);
    return 0;
  }
  memcpy(home, account.pw_dir, home_length + 1);
  *resolved_uid = effective_uid;
  *resolved_gid = account.pw_gid;
  safe_git_secure_zero(buffer, buffer_size);
  free(buffer);
  return 1;
}

static int resolve_installation_state_root(char root[SAFE_GIT_PATH_LIMIT + 1],
                                           const char **resolver_id,
                                           uid_t *resolved_uid,
                                           gid_t *resolved_gid) {
  char home[SAFE_GIT_PATH_LIMIT + 1];
  int written;
  memset(home, 0, sizeof(home));
  if (root == NULL || resolver_id == NULL || resolved_uid == NULL ||
      resolved_gid == NULL ||
      !installation_account_home(home, resolved_uid, resolved_gid)) {
    return 0;
  }
#if defined(__linux__)
  written = snprintf(root, SAFE_GIT_PATH_LIMIT + 1,
                     strcmp(home, "/") == 0
                         ? "/.local/state/understand-code"
                         : "%s/.local/state/understand-code",
                     home);
  *resolver_id = "linux-getpwuid-effective-user-state-v1";
#elif defined(__APPLE__)
  FSRef application_support_reference;
  UInt8 application_support_path[SAFE_GIT_PATH_LIMIT + 1];
  char expected_application_support[SAFE_GIT_PATH_LIMIT + 1];
  OSStatus find_status;
  OSStatus path_status;
  memset(&application_support_reference, 0,
         sizeof(application_support_reference));
  memset(application_support_path, 0, sizeof(application_support_path));
  memset(expected_application_support, 0, sizeof(expected_application_support));
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  find_status = FSFindFolder(kUserDomain, kApplicationSupportFolderType, false,
                             &application_support_reference);
  path_status =
      find_status == noErr
          ? FSRefMakePath(&application_support_reference,
                          application_support_path,
                          sizeof(application_support_path))
          : find_status;
#pragma clang diagnostic pop
  if (find_status != noErr || path_status != noErr ||
      application_support_path[0] != '/' ||
      snprintf(expected_application_support,
               sizeof(expected_application_support),
               strcmp(home, "/") == 0 ? "/Library/Application Support"
                                      : "%s/Library/Application Support",
               home) <= 0 ||
      strcmp((const char *)application_support_path,
             expected_application_support) != 0) {
    safe_git_secure_zero(home, sizeof(home));
    safe_git_secure_zero(application_support_path,
                         sizeof(application_support_path));
    safe_git_secure_zero(expected_application_support,
                         sizeof(expected_application_support));
    return 0;
  }
  written = snprintf(root, SAFE_GIT_PATH_LIMIT + 1, "%s/understand-code",
                     (const char *)application_support_path);
  *resolver_id = "darwin-user-domain-application-support-v1";
  safe_git_secure_zero(application_support_path,
                       sizeof(application_support_path));
  safe_git_secure_zero(expected_application_support,
                       sizeof(expected_application_support));
#else
  written = -1;
#endif
  safe_git_secure_zero(home, sizeof(home));
  return written > 0 && written <= (int)SAFE_GIT_PATH_LIMIT && root[0] == '/';
}

static napi_value resolve_native_installation_state_root(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value ignored_argument;
  napi_value result;
  napi_value uid_value;
  napi_value gid_value;
  char root[SAFE_GIT_PATH_LIMIT + 1];
  const char *resolver_id = NULL;
  uid_t resolved_uid = 0;
  gid_t resolved_gid = 0;
  memset(root, 0, sizeof(root));
  if (napi_get_cb_info(env, info, &argument_count, &ignored_argument, NULL,
                       NULL) != napi_ok ||
      argument_count != 0 ||
      !resolve_installation_state_root(root, &resolver_id, &resolved_uid,
                                       &resolved_gid) ||
      resolver_id == NULL || napi_create_object(env, &result) != napi_ok ||
      !safe_git_set_string_property(env, result, "profile",
                                    "native_installation_state_resolver_v1") ||
      !safe_git_set_string_property(env, result, "resolverId", resolver_id) ||
      !safe_git_set_string_property(env, result, "root", root) ||
      napi_create_uint32(env, (uint32_t)resolved_uid, &uid_value) != napi_ok ||
      napi_create_uint32(env, (uint32_t)resolved_gid, &gid_value) != napi_ok ||
      napi_set_named_property(env, result, "uid", uid_value) != napi_ok ||
      napi_set_named_property(env, result, "gid", gid_value) != napi_ok) {
    safe_git_secure_zero(root, sizeof(root));
    return throw_installation_state_authority_unavailable(env);
  }
  safe_git_secure_zero(root, sizeof(root));
  return result;
}

static int installation_directory_admitted(int file_descriptor,
                                            const struct stat *expected,
                                            int managed) {
  struct stat after;
  uid_t effective_uid = geteuid();
  gid_t effective_gid = getegid();
  memset(&after, 0, sizeof(after));
  if (!S_ISDIR(expected->st_mode) ||
      (managed
           ? (expected->st_uid != effective_uid ||
              expected->st_gid != effective_gid ||
              (((unsigned int)expected->st_mode) & 07777U) != 0700U)
           : ((expected->st_uid != effective_uid && expected->st_uid != 0) ||
              ((((unsigned int)expected->st_mode) & 0022U) != 0U &&
               !(expected->st_uid == 0 &&
                 (((unsigned int)expected->st_mode) & 07777U) == 01777U)))) ||
      !fd_has_no_extended_access_control(file_descriptor,
                                         EXPECTED_FILE_KIND_DIRECTORY) ||
      fstat(file_descriptor, &after) != 0 ||
      !safe_git_identity_matches(expected, &after,
                                 SAFE_GIT_BOUND_DIRECTORY)) {
    return 0;
  }
  return 1;
}

static void installation_authority_release(
    struct installation_state_authority *authority) {
  size_t index;
  if (authority == NULL) return;
  for (index = authority->node_count; index > 0; index -= 1) {
    if (authority->nodes[index - 1].file_descriptor >= 0) {
      (void)close(authority->nodes[index - 1].file_descriptor);
      authority->nodes[index - 1].file_descriptor = -1;
    }
  }
  authority->node_count = 0;
  if (authority->canonical_state_root_bytes != NULL) {
    safe_git_secure_zero(authority->canonical_state_root_bytes,
                         strlen(authority->canonical_state_root_bytes));
    free(authority->canonical_state_root_bytes);
    authority->canonical_state_root_bytes = NULL;
  }
  safe_git_secure_zero(authority->owner_identity,
                       sizeof(authority->owner_identity));
  safe_git_secure_zero(authority->artifact_pins,
                       sizeof(authority->artifact_pins));
  authority->closed = 1;
}

static void installation_authority_finalizer(napi_env env, void *data,
                                             void *hint) {
  struct installation_state_authority *authority =
      (struct installation_state_authority *)data;
  (void)env;
  (void)hint;
  installation_authority_release(authority);
  free(authority);
}

static int installation_authority_add_node(
    struct installation_state_authority *authority, int file_descriptor,
    int parent_index, const char *component, int managed, int *node_index) {
  struct installation_authority_node *node;
  struct stat metadata;
  size_t component_length = component == NULL ? 0 : strlen(component);
  memset(&metadata, 0, sizeof(metadata));
  if (authority == NULL || authority->closed || node_index == NULL ||
      authority->node_count >= INSTALLATION_AUTHORITY_NODE_LIMIT ||
      parent_index < -1 ||
      (parent_index >= 0 && (size_t)parent_index >= authority->node_count) ||
      component_length > NAME_MAX || fstat(file_descriptor, &metadata) != 0 ||
      !installation_directory_admitted(file_descriptor, &metadata, managed)) {
    return 0;
  }
  node = &authority->nodes[authority->node_count];
  memset(node, 0, sizeof(*node));
  node->file_descriptor = file_descriptor;
  node->parent_index = parent_index;
  node->managed = managed;
  node->snapshot = metadata;
  if (component_length > 0) memcpy(node->component, component, component_length);
  node->component[component_length] = '\0';
  *node_index = (int)authority->node_count;
  authority->node_count += 1;
  return 1;
}

static int installation_authority_open_process_root(
    struct installation_state_authority *authority, int *node_index) {
  int file_descriptor =
      open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (file_descriptor < 0 ||
      !installation_authority_add_node(authority, file_descriptor, -1, "", 0,
                                       node_index)) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  return 1;
}

static int installation_authority_open_child(
    struct installation_state_authority *authority, int parent_index,
    const char *component, int managed, int allow_create, int *created,
    int *node_index) {
  struct stat before;
  struct stat after;
  int file_descriptor;
  int was_created = 0;
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (authority == NULL || created == NULL || node_index == NULL ||
      parent_index < 0 || (size_t)parent_index >= authority->node_count ||
      !safe_git_component_is_valid(component)) {
    return 0;
  }
  errno = 0;
  if (fstatat(authority->nodes[parent_index].file_descriptor, component,
              &before, AT_SYMLINK_NOFOLLOW) != 0) {
    if (errno != ENOENT || !allow_create ||
        mkdirat(authority->nodes[parent_index].file_descriptor, component,
                0700) != 0 ||
        fsync(authority->nodes[parent_index].file_descriptor) != 0 ||
        fstatat(authority->nodes[parent_index].file_descriptor, component,
                &before, AT_SYMLINK_NOFOLLOW) != 0) {
      return 0;
    }
    was_created = 1;
  }
  if (!S_ISDIR(before.st_mode)) return 0;
  file_descriptor =
      openat(authority->nodes[parent_index].file_descriptor, component,
             O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (file_descriptor < 0 || fstat(file_descriptor, &after) != 0 ||
      !safe_git_identity_matches(&before, &after,
                                 SAFE_GIT_BOUND_DIRECTORY) ||
      (was_created && fsync(file_descriptor) != 0) ||
      !installation_authority_add_node(authority, file_descriptor,
                                       parent_index, component, managed,
                                       node_index)) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  *created = was_created;
  return 1;
}

static size_t installation_path_component_count(const char *path) {
  size_t count = 0;
  size_t index = 1;
  size_t length;
  if (path == NULL || path[0] != '/') return 0;
  length = strlen(path);
  if (length <= 1 || length > SAFE_GIT_PATH_LIMIT || path[length - 1] == '/') {
    return 0;
  }
  while (index < length) {
    size_t end = index;
    while (end < length && path[end] != '/') end += 1;
    if (end == index || end - index > NAME_MAX) return 0;
    count += 1;
    index = end + 1;
  }
  return count;
}

static int installation_authority_resolve_root(
    struct installation_state_authority *authority, const char *path,
    int create, size_t creation_suffix_components, int *root_created,
    int *root_index) {
  size_t total = installation_path_component_count(path);
  size_t ordinal = 0;
  size_t cursor = 1;
  size_t length = strlen(path);
  int current;
  if (total == 0 || creation_suffix_components == 0 ||
      creation_suffix_components > total ||
      !installation_authority_open_process_root(authority, &current) ||
      current != 0) {
    return 0;
  }
  while (cursor < length) {
    size_t end = cursor;
    size_t component_length;
    char component[NAME_MAX + 1];
    int child;
    int created = 0;
    int is_final;
    while (end < length && path[end] != '/') end += 1;
    component_length = end - cursor;
    memcpy(component, path + cursor, component_length);
    component[component_length] = '\0';
    is_final = ordinal + 1 == total;
    if (strcmp(component, ".") == 0 || strcmp(component, "..") == 0 ||
        !installation_authority_open_child(
            authority, current, component, is_final,
            create && ordinal >= total - creation_suffix_components, &created,
            &child)) {
      return 0;
    }
    if (is_final) *root_created = created;
    current = child;
    ordinal += 1;
    cursor = end + 1;
  }
  *root_index = current;
  return ordinal == total;
}

static int installation_authority_open_managed_child(
    struct installation_state_authority *authority, int parent_index,
    const char *component, int create, int *node_index) {
  int created = 0;
  return installation_authority_open_child(authority, parent_index, component,
                                           1, create, &created, node_index);
}

static int installation_authority_revalidate(
    struct installation_state_authority *authority) {
  size_t index;
  if (authority == NULL || authority->closed || authority->node_count == 0) {
    return 0;
  }
  for (index = 0; index < authority->node_count; index += 1) {
    struct installation_authority_node *node = &authority->nodes[index];
    struct stat at_handle;
    memset(&at_handle, 0, sizeof(at_handle));
    if (fstat(node->file_descriptor, &at_handle) != 0 ||
        !safe_git_identity_matches(&node->snapshot, &at_handle,
                                   SAFE_GIT_BOUND_DIRECTORY) ||
        !installation_directory_admitted(node->file_descriptor, &at_handle,
                                         node->managed)) {
      return 0;
    }
    if (node->parent_index >= 0) {
      struct stat at_parent;
      memset(&at_parent, 0, sizeof(at_parent));
      if (fstatat(authority->nodes[node->parent_index].file_descriptor,
                  node->component, &at_parent, AT_SYMLINK_NOFOLLOW) != 0 ||
          !safe_git_identity_matches(&node->snapshot, &at_parent,
                                     SAFE_GIT_BOUND_DIRECTORY)) {
        return 0;
      }
    }
  }
  return 1;
}

static int installation_encode_internal_bytes(const unsigned char *bytes,
                                              size_t length,
                                              char **encoded) {
  static const char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  size_t encoded_length;
  size_t output_length;
  size_t input_index = 0;
  size_t cursor = 10;
  char *output;
  if (bytes == NULL || length == 0 || encoded == NULL) return 0;
  encoded_length = (length / 3) * 4 +
                   (length % 3 == 0 ? 0 : length % 3 + 1);
  if (encoded_length > SIZE_MAX - 11) return 0;
  output_length = 10 + encoded_length;
  output = (char *)malloc(output_length + 1);
  if (output == NULL) return 0;
  memcpy(output, "base64url:", 10);
  while (input_index + 3 <= length) {
    uint32_t value = ((uint32_t)bytes[input_index] << 16U) |
                     ((uint32_t)bytes[input_index + 1] << 8U) |
                     (uint32_t)bytes[input_index + 2];
    output[cursor++] = alphabet[(value >> 18U) & 0x3fU];
    output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
    output[cursor++] = alphabet[(value >> 6U) & 0x3fU];
    output[cursor++] = alphabet[value & 0x3fU];
    input_index += 3;
  }
  if (input_index < length) {
    uint32_t value = (uint32_t)bytes[input_index] << 16U;
    output[cursor++] = alphabet[(value >> 18U) & 0x3fU];
    if (input_index + 1 < length) {
      value |= (uint32_t)bytes[input_index + 1] << 8U;
      output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
      output[cursor++] = alphabet[(value >> 6U) & 0x3fU];
    } else {
      output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
    }
  }
  output[cursor] = '\0';
  if (cursor != output_length) {
    safe_git_secure_zero(output, output_length);
    free(output);
    return 0;
  }
  *encoded = output;
  return 1;
}

static int installation_authority_namespace_shape(
    struct installation_state_authority *authority);

static struct installation_state_authority *installation_authority_open(
    const char *root_path, const char *resolver_id, int create,
    size_t creation_suffix_components, int *root_created) {
  struct installation_state_authority *authority =
      (struct installation_state_authority *)calloc(1, sizeof(*authority));
  char owner[64];
  char *owner_encoded = NULL;
  int create_structure;
  if (authority == NULL || root_created == NULL) {
    free(authority);
    return NULL;
  }
  authority->root_index = -1;
  authority->runtime_state_index = -1;
  authority->private_index = -1;
  authority->provider_index = -1;
  authority->acceptance_index = -1;
  authority->resolver_id = resolver_id;
  memset(owner, 0, sizeof(owner));
  if (snprintf(owner, sizeof(owner), "posix-uid:%" PRIuMAX,
               (uintmax_t)geteuid()) <= 0 ||
      !installation_encode_internal_bytes((const unsigned char *)root_path,
                                          strlen(root_path),
                                          &authority->canonical_state_root_bytes) ||
      !installation_encode_internal_bytes((const unsigned char *)owner,
                                          strlen(owner), &owner_encoded) ||
      strlen(owner_encoded) >= sizeof(authority->owner_identity)) {
    safe_git_secure_zero(owner, sizeof(owner));
    if (owner_encoded != NULL) {
      safe_git_secure_zero(owner_encoded, strlen(owner_encoded));
      free(owner_encoded);
    }
    installation_authority_release(authority);
    free(authority);
    return NULL;
  }
  memcpy(authority->owner_identity, owner_encoded, strlen(owner_encoded) + 1);
  safe_git_secure_zero(owner_encoded, strlen(owner_encoded));
  free(owner_encoded);
  owner_encoded = NULL;
  if (!installation_authority_resolve_root(
          authority, root_path, create, creation_suffix_components,
          root_created, &authority->root_index)) {
    safe_git_secure_zero(owner, sizeof(owner));
    installation_authority_release(authority);
    free(authority);
    return NULL;
  }
  create_structure = create && *root_created;
  if (
      !installation_authority_open_managed_child(
          authority, authority->root_index, "runtime-state", create_structure,
          &authority->runtime_state_index) ||
      !installation_authority_open_managed_child(
          authority, authority->runtime_state_index, "private", create_structure,
          &authority->private_index) ||
      !installation_authority_open_managed_child(
          authority, authority->root_index, "provider", create_structure,
          &authority->provider_index) ||
      !installation_authority_open_managed_child(
          authority, authority->provider_index, "acceptance", create_structure,
          &authority->acceptance_index) ||
      !installation_authority_revalidate(authority) ||
      !installation_authority_namespace_shape(authority)) {
    safe_git_secure_zero(owner, sizeof(owner));
    installation_authority_release(authority);
    free(authority);
    return NULL;
  }
  safe_git_secure_zero(owner, sizeof(owner));
  return authority;
}

static struct installation_state_authority *
installation_authority_open_with_readonly_wait(
    const char *root_path, const char *resolver_id, int create,
    size_t creation_suffix_components, int *root_created) {
  struct installation_state_authority *authority = installation_authority_open(
      root_path, resolver_id, create, creation_suffix_components, root_created);
  size_t attempt;
  if (authority != NULL || !create || *root_created) return authority;
  /* Another process may have won the exclusive root mkdir and still be
   * fsyncing the fixed structural suffix. Losers never add or repair entries;
   * they only retry a fully read-only open for a short bounded interval. */
  for (attempt = 0; attempt < 250; attempt += 1) {
    struct timespec delay;
    int ignored_created = 0;
    delay.tv_sec = 0;
    delay.tv_nsec = 1000000L;
    (void)nanosleep(&delay, NULL);
    authority = installation_authority_open(
        root_path, resolver_id, 0, creation_suffix_components,
        &ignored_created);
    if (authority != NULL) return authority;
  }
  return NULL;
}

static int installation_create_root_identity(
    napi_env env, const struct installation_state_authority *authority,
    napi_value *result) {
  const struct stat *metadata;
  char device[32];
  char inode[32];
  if (authority == NULL || authority->root_index < 0 ||
      (size_t)authority->root_index >= authority->node_count) {
    return 0;
  }
  metadata = &authority->nodes[authority->root_index].snapshot;
  if (snprintf(device, sizeof(device), "%" PRIuMAX,
               (uintmax_t)metadata->st_dev) <= 0 ||
      snprintf(inode, sizeof(inode), "%" PRIuMAX,
               (uintmax_t)metadata->st_ino) <= 0 ||
      napi_create_object(env, result) != napi_ok ||
      !safe_git_set_string_property(env, *result, "platform", "posix") ||
      !safe_git_set_string_property(env, *result, "device", device) ||
      !safe_git_set_string_property(env, *result, "inode", inode)) {
    return 0;
  }
  return 1;
}

static int installation_create_authority_inspection(
    napi_env env, const struct installation_state_authority *authority,
    napi_value authority_object, int root_created, napi_value *result) {
  napi_value root_identity;
  napi_value created_value;
  if (authority == NULL || authority->resolver_id == NULL ||
      authority->canonical_state_root_bytes == NULL ||
      authority->owner_identity[0] == '\0' ||
      !installation_create_root_identity(env, authority, &root_identity) ||
      napi_create_object(env, result) != napi_ok ||
      !safe_git_set_string_property(env, *result, "profile",
                                    "native_installation_state_authority_v1") ||
      !safe_git_set_string_property(env, *result, "resolverId",
                                    authority->resolver_id) ||
      !safe_git_set_string_property(env, *result, "canonicalStateRootBytes",
                                    authority->canonical_state_root_bytes) ||
      !safe_git_set_string_property(env, *result, "ownerIdentity",
                                    authority->owner_identity) ||
      napi_set_named_property(env, *result, "rootIdentity", root_identity) !=
          napi_ok) {
    return 0;
  }
  if (authority_object != NULL) {
    if (napi_get_boolean(env, root_created != 0, &created_value) != napi_ok ||
        napi_set_named_property(env, *result, "rootCreated", created_value) !=
            napi_ok ||
        napi_set_named_property(env, *result, "authority", authority_object) !=
            napi_ok) {
      return 0;
    }
  }
  return 1;
}

static int installation_read_boolean_argument(napi_env env,
                                              napi_callback_info info,
                                              int *create) {
  size_t argument_count = 1;
  napi_value argument;
  napi_valuetype type;
  bool value;
  if (create == NULL ||
      napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 || napi_typeof(env, argument, &type) != napi_ok ||
      type != napi_boolean || napi_get_value_bool(env, argument, &value) != napi_ok) {
    return 0;
  }
  *create = value ? 1 : 0;
  return 1;
}

static int installation_read_test_open_arguments(napi_env env,
                                                 napi_callback_info info,
                                                 char **root_path,
                                                 int *create) {
  size_t argument_count = 2;
  napi_value arguments[2];
  napi_valuetype root_type;
  napi_valuetype create_type;
  size_t length = 0;
  size_t copied = 0;
  bool create_value;
  char *buffer;
  if (root_path == NULL || create == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      napi_typeof(env, arguments[0], &root_type) != napi_ok ||
      root_type != napi_string ||
      napi_get_value_string_utf8(env, arguments[0], NULL, 0, &length) != napi_ok ||
      length == 0 || length > SAFE_GIT_PATH_LIMIT ||
      napi_typeof(env, arguments[1], &create_type) != napi_ok ||
      create_type != napi_boolean ||
      napi_get_value_bool(env, arguments[1], &create_value) != napi_ok) {
    return 0;
  }
  buffer = (char *)malloc(length + 1);
  if (buffer == NULL ||
      napi_get_value_string_utf8(env, arguments[0], buffer, length + 1,
                                 &copied) != napi_ok ||
      copied != length || strlen(buffer) != length || buffer[0] != '/') {
    free(buffer);
    return 0;
  }
  *root_path = buffer;
  *create = create_value ? 1 : 0;
  return 1;
}

static int installation_unwrap_authority(
    napi_env env, napi_value value,
    struct installation_state_authority **authority) {
  bool tagged = false;
  return authority != NULL &&
         napi_check_object_type_tag(env, value,
                                    &INSTALLATION_AUTHORITY_TYPE_TAG,
                                    &tagged) == napi_ok &&
         tagged && napi_unwrap(env, value, (void **)authority) == napi_ok &&
         *authority != NULL;
}

static int installation_unwrap_authority_argument(
    napi_env env, napi_callback_info info,
    struct installation_state_authority **authority) {
  size_t argument_count = 1;
  napi_value argument;
  return napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) ==
             napi_ok &&
         argument_count == 1 &&
         installation_unwrap_authority(env, argument, authority);
}

static napi_value installation_open_result(
    napi_env env, struct installation_state_authority *authority,
    int root_created) {
  napi_value authority_object;
  napi_value result;
  if (authority == NULL) {
    return throw_installation_state_authority_unavailable(env);
  }
  if (napi_create_object(env, &authority_object) != napi_ok ||
      napi_wrap(env, authority_object, authority, installation_authority_finalizer,
                NULL, NULL) != napi_ok) {
    installation_authority_release(authority);
    free(authority);
    return throw_installation_state_authority_unavailable(env);
  }
  if (napi_type_tag_object(env, authority_object,
                           &INSTALLATION_AUTHORITY_TYPE_TAG) != napi_ok ||
      !installation_create_authority_inspection(
          env, authority, authority_object, root_created, &result)) {
    installation_authority_release(authority);
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static napi_value open_installation_state_authority(napi_env env,
                                                     napi_callback_info info) {
  int create = 0;
  int root_created = 0;
  char root[SAFE_GIT_PATH_LIMIT + 1];
  const char *resolver_id = NULL;
  uid_t ignored_uid = 0;
  gid_t ignored_gid = 0;
  struct installation_state_authority *authority;
  size_t creation_suffix_components;
  memset(root, 0, sizeof(root));
  if (!installation_read_boolean_argument(env, info, &create) ||
      !resolve_installation_state_root(root, &resolver_id, &ignored_uid,
                                       &ignored_gid) ||
      resolver_id == NULL) {
    safe_git_secure_zero(root, sizeof(root));
    return throw_installation_state_root_unavailable(env);
  }
#if defined(__linux__)
  creation_suffix_components = 3;
#else
  creation_suffix_components = 1;
#endif
  authority = installation_authority_open_with_readonly_wait(
      root, resolver_id, create, creation_suffix_components, &root_created);
  safe_git_secure_zero(root, sizeof(root));
  if (authority == NULL) return throw_installation_state_authority_unavailable(env);
  return installation_open_result(env, authority, root_created);
}

static napi_value open_test_installation_state_authority(
    napi_env env, napi_callback_info info) {
  char *root_path = NULL;
  int create = 0;
  int root_created = 0;
  struct installation_state_authority *authority;
  if (!installation_read_test_open_arguments(env, info, &root_path, &create)) {
    return throw_installation_state_authority_unavailable(env);
  }
  authority = installation_authority_open_with_readonly_wait(
      root_path, "test-explicit-temporary-root-v1", create, 1, &root_created);
  safe_git_secure_zero(root_path, strlen(root_path));
  free(root_path);
  if (authority == NULL) return throw_installation_state_authority_unavailable(env);
  return installation_open_result(env, authority, root_created);
}

static napi_value revalidate_installation_state_authority(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (!installation_unwrap_authority_argument(env, info, &authority) ||
      !installation_authority_revalidate(authority) ||
      !installation_authority_namespace_shape(authority) ||
      !installation_create_authority_inspection(env, authority, NULL, 0,
                                                &result)) {
    if (authority != NULL) installation_authority_release(authority);
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static napi_value close_installation_state_authority(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (!installation_unwrap_authority_argument(env, info, &authority)) {
    return throw_installation_state_authority_unavailable(env);
  }
  installation_authority_release(authority);
  if (napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

enum installation_identity_artifact {
  INSTALLATION_ARTIFACT_KEY = 0,
  INSTALLATION_ARTIFACT_STATE = 1,
  INSTALLATION_ARTIFACT_INIT = 2,
  INSTALLATION_ARTIFACT_INIT_STAGE = 3,
};

static const char *installation_artifact_name(
    enum installation_identity_artifact artifact) {
  switch (artifact) {
    case INSTALLATION_ARTIFACT_KEY:
      return "installation-identity-v1.key";
    case INSTALLATION_ARTIFACT_STATE:
      return "installation-identity-v1.json";
    case INSTALLATION_ARTIFACT_INIT:
      return "installation-identity-v1.init";
    case INSTALLATION_ARTIFACT_INIT_STAGE:
      return ".installation-identity-v1.init.stage";
  }
  return NULL;
}

static size_t installation_artifact_maximum(
    enum installation_identity_artifact artifact) {
  return artifact == INSTALLATION_ARTIFACT_KEY
             ? (size_t)32
             : INSTALLATION_IDENTITY_RECORD_LIMIT;
}

static int installation_parse_artifact_value(
    napi_env env, napi_value value,
    enum installation_identity_artifact *artifact) {
  napi_valuetype type;
  char text[16];
  size_t length = 0;
  if (artifact == NULL || napi_typeof(env, value, &type) != napi_ok ||
      type != napi_string ||
      napi_get_value_string_utf8(env, value, text, sizeof(text), &length) !=
          napi_ok) {
    return 0;
  }
  if (length == 3 && strcmp(text, "key") == 0) {
    *artifact = INSTALLATION_ARTIFACT_KEY;
  } else if (length == 5 && strcmp(text, "state") == 0) {
    *artifact = INSTALLATION_ARTIFACT_STATE;
  } else if (length == 4 && strcmp(text, "init") == 0) {
    *artifact = INSTALLATION_ARTIFACT_INIT;
  } else if (length == 10 && strcmp(text, "init_stage") == 0) {
    *artifact = INSTALLATION_ARTIFACT_INIT_STAGE;
  } else {
    return 0;
  }
  return 1;
}

static int installation_file_admitted(int file_descriptor,
                                       const struct stat *expected) {
  struct stat after;
  memset(&after, 0, sizeof(after));
  return S_ISREG(expected->st_mode) && expected->st_uid == geteuid() &&
         expected->st_gid == getegid() &&
         (((unsigned int)expected->st_mode) & 07777U) == 0600U &&
         expected->st_nlink == 1 && expected->st_size > 0 &&
         fd_has_no_extended_access_control(file_descriptor,
                                           EXPECTED_FILE_KIND_REGULAR_FILE) &&
         fstat(file_descriptor, &after) == 0 &&
         stat_snapshot_matches(expected, &after);
}

static int installation_artifact_identity_matches(const struct stat *expected,
                                                  const struct stat *observed) {
  return S_ISREG(observed->st_mode) && expected->st_dev == observed->st_dev &&
         expected->st_ino == observed->st_ino &&
         expected->st_mode == observed->st_mode &&
         expected->st_uid == observed->st_uid &&
         expected->st_gid == observed->st_gid &&
         expected->st_nlink == observed->st_nlink &&
         expected->st_size == observed->st_size;
}

static void installation_sha256_bytes(const unsigned char *bytes,
                                      size_t length,
                                      unsigned char digest[32]) {
  struct safe_git_sha256_context context;
  safe_git_sha256_init(&context);
  safe_git_sha256_update(&context, bytes, length);
  safe_git_sha256_final(&context, digest);
  safe_git_secure_zero(&context, sizeof(context));
}

static int installation_read_artifact(
    struct installation_state_authority *authority,
    enum installation_identity_artifact artifact, unsigned char **bytes,
    size_t *length, int *present, struct stat *snapshot,
    unsigned char digest[32]) {
  const char *name = installation_artifact_name(artifact);
  size_t maximum = installation_artifact_maximum(artifact);
  struct stat before;
  struct stat after_path;
  struct stat directory_before;
  struct stat directory_after;
  int file_descriptor;
  unsigned char *content;
  memset(&before, 0, sizeof(before));
  memset(&after_path, 0, sizeof(after_path));
  memset(&directory_before, 0, sizeof(directory_before));
  memset(&directory_after, 0, sizeof(directory_after));
  if (authority == NULL || bytes == NULL || length == NULL || present == NULL ||
      snapshot == NULL || digest == NULL || name == NULL ||
      !installation_authority_revalidate(authority)) {
    return 0;
  }
  if (fstat(authority->nodes[authority->private_index].file_descriptor,
            &directory_before) != 0) {
    return 0;
  }
  errno = 0;
  if (fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &before, AT_SYMLINK_NOFOLLOW) != 0) {
    if (errno != ENOENT) return 0;
    *bytes = NULL;
    *length = 0;
    *present = 0;
    memset(snapshot, 0, sizeof(*snapshot));
    memset(digest, 0, 32);
    return fstat(authority->nodes[authority->private_index].file_descriptor,
                 &directory_after) == 0 &&
           stat_snapshot_matches(&directory_before, &directory_after) &&
           installation_authority_revalidate(authority);
  }
  if (!S_ISREG(before.st_mode) || before.st_size <= 0 ||
      (uintmax_t)before.st_size > (uintmax_t)maximum ||
      (artifact == INSTALLATION_ARTIFACT_KEY && before.st_size != 32)) {
    return 0;
  }
  file_descriptor =
      openat(authority->nodes[authority->private_index].file_descriptor, name,
             O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK | O_NOCTTY);
  if (file_descriptor < 0 ||
      !installation_file_admitted(file_descriptor, &before)) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  content = (unsigned char *)malloc((size_t)before.st_size);
  if (content == NULL ||
      !safe_git_pread_exact(file_descriptor, content, (size_t)before.st_size) ||
      fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &after_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after_path) ||
      fstat(authority->nodes[authority->private_index].file_descriptor,
            &directory_after) != 0 ||
      !stat_snapshot_matches(&directory_before, &directory_after)) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    if (content != NULL) {
      safe_git_secure_zero(content, (size_t)before.st_size);
      free(content);
    }
    return 0;
  }
  if (close(file_descriptor) != 0) {
    file_descriptor = -1;
    safe_git_secure_zero(content, (size_t)before.st_size);
    free(content);
    return 0;
  }
  file_descriptor = -1;
  if (!installation_authority_revalidate(authority)) {
    safe_git_secure_zero(content, (size_t)before.st_size);
    free(content);
    return 0;
  }
  installation_sha256_bytes(content, (size_t)before.st_size, digest);
  *bytes = content;
  *length = (size_t)before.st_size;
  *present = 1;
  *snapshot = before;
  return 1;
}

static int installation_read_artifact_arguments(
    napi_env env, napi_callback_info info,
    struct installation_state_authority **authority,
    enum installation_identity_artifact *artifact) {
  size_t argument_count = 2;
  napi_value arguments[2];
  return napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) ==
             napi_ok &&
         argument_count == 2 &&
         installation_unwrap_authority(env, arguments[0], authority) &&
         installation_parse_artifact_value(env, arguments[1], artifact);
}

static napi_value read_installation_identity_artifact(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  enum installation_identity_artifact artifact;
  unsigned char *bytes = NULL;
  size_t length = 0;
  int present = 0;
  struct stat snapshot;
  unsigned char digest[32];
  napi_value result;
  memset(&snapshot, 0, sizeof(snapshot));
  memset(digest, 0, sizeof(digest));
  if (!installation_read_artifact_arguments(env, info, &authority, &artifact) ||
      !installation_read_artifact(authority, artifact, &bytes, &length,
                                  &present, &snapshot, digest)) {
    return throw_installation_state_authority_unavailable(env);
  }
  authority->artifact_pins[artifact].observed = 1;
  authority->artifact_pins[artifact].present = present;
  authority->artifact_pins[artifact].snapshot = snapshot;
  memcpy(authority->artifact_pins[artifact].content_digest, digest, 32);
  if (!present) {
    if (napi_get_null(env, &result) != napi_ok) {
      return throw_installation_state_authority_unavailable(env);
    }
  } else if (napi_create_buffer_copy(env, length, bytes, NULL, &result) !=
             napi_ok) {
    safe_git_secure_zero(bytes, length);
    free(bytes);
    return throw_installation_state_authority_unavailable(env);
  }
  if (bytes != NULL) {
    safe_git_secure_zero(bytes, length);
    free(bytes);
  }
  safe_git_secure_zero(digest, sizeof(digest));
  return result;
}

static int installation_write_all(int file_descriptor,
                                  const unsigned char *bytes,
                                  size_t length) {
  size_t offset = 0;
  while (offset < length) {
    ssize_t written = pwrite(file_descriptor, bytes + offset, length - offset,
                             (off_t)offset);
    if (written <= 0) return 0;
    offset += (size_t)written;
  }
  return 1;
}

static int installation_create_artifact(
    struct installation_state_authority *authority,
    enum installation_identity_artifact artifact,
    const unsigned char *bytes, size_t length) {
  const char *name = installation_artifact_name(artifact);
  int private_fd;
  int file_descriptor;
  unsigned char *observed_bytes = NULL;
  size_t observed_length = 0;
  int present = 0;
  struct stat snapshot;
  unsigned char digest[32];
  if (authority == NULL || name == NULL || bytes == NULL || length == 0 ||
      length > installation_artifact_maximum(artifact) ||
      (artifact == INSTALLATION_ARTIFACT_KEY && length != 32) ||
      !installation_authority_revalidate(authority)) {
    return 0;
  }
  private_fd = authority->nodes[authority->private_index].file_descriptor;
  file_descriptor =
      openat(private_fd, name,
             O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK |
                 O_NOCTTY,
             0600);
  if (file_descriptor < 0 || fchmod(file_descriptor, 0600) != 0 ||
      !installation_write_all(file_descriptor, bytes, length) ||
      fsync(file_descriptor) != 0) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  if (close(file_descriptor) != 0) {
    file_descriptor = -1;
    return 0;
  }
  file_descriptor = -1;
  if (fsync(private_fd) != 0 ||
      !installation_read_artifact(authority, artifact, &observed_bytes,
                                  &observed_length, &present, &snapshot,
                                  digest) ||
      !present || observed_length != length ||
      memcmp(observed_bytes, bytes, length) != 0) {
    if (observed_bytes != NULL) {
      safe_git_secure_zero(observed_bytes, observed_length);
      free(observed_bytes);
    }
    safe_git_secure_zero(digest, sizeof(digest));
    return 0;
  }
  authority->artifact_pins[artifact].observed = 1;
  authority->artifact_pins[artifact].present = 1;
  authority->artifact_pins[artifact].snapshot = snapshot;
  memcpy(authority->artifact_pins[artifact].content_digest, digest, 32);
  safe_git_secure_zero(observed_bytes, observed_length);
  free(observed_bytes);
  safe_git_secure_zero(digest, sizeof(digest));
  return installation_authority_revalidate(authority);
}

static napi_value create_installation_identity_artifact(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 3;
  napi_value arguments[3];
  struct installation_state_authority *authority = NULL;
  enum installation_identity_artifact artifact;
  bool is_buffer = false;
  void *bytes = NULL;
  size_t length = 0;
  napi_value result;
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 3 ||
      !installation_unwrap_authority(env, arguments[0], &authority) ||
      !installation_parse_artifact_value(env, arguments[1], &artifact) ||
      napi_is_buffer(env, arguments[2], &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, arguments[2], &bytes, &length) != napi_ok ||
      bytes == NULL ||
      !installation_create_artifact(authority, artifact,
                                    (const unsigned char *)bytes, length) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static int installation_open_pinned_artifact(
    struct installation_state_authority *authority,
    enum installation_identity_artifact artifact,
    const struct installation_artifact_pin *pin, int *file_descriptor) {
  const char *name = installation_artifact_name(artifact);
  struct stat at_path;
  struct stat at_handle;
  unsigned char *bytes = NULL;
  unsigned char digest[32];
  int descriptor;
  if (authority == NULL || pin == NULL || file_descriptor == NULL ||
      name == NULL || !pin->observed) {
    return 0;
  }
  memset(&at_path, 0, sizeof(at_path));
  memset(&at_handle, 0, sizeof(at_handle));
  memset(digest, 0, sizeof(digest));
  errno = 0;
  if (!pin->present) {
    return fstatat(authority->nodes[authority->private_index].file_descriptor,
                   name, &at_path, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT;
  }
  if (fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &at_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&pin->snapshot, &at_path)) {
    return 0;
  }
  descriptor =
      openat(authority->nodes[authority->private_index].file_descriptor, name,
             O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK | O_NOCTTY);
  if (descriptor < 0 || fstat(descriptor, &at_handle) != 0 ||
      !stat_snapshot_matches(&pin->snapshot, &at_handle) ||
      !installation_file_admitted(descriptor, &at_handle)) {
    if (descriptor >= 0) (void)close(descriptor);
    return 0;
  }
  bytes = (unsigned char *)malloc((size_t)at_handle.st_size);
  if (bytes == NULL ||
      !safe_git_pread_exact(descriptor, bytes, (size_t)at_handle.st_size)) {
    if (bytes != NULL) {
      safe_git_secure_zero(bytes, (size_t)at_handle.st_size);
      free(bytes);
    }
    (void)close(descriptor);
    return 0;
  }
  installation_sha256_bytes(bytes, (size_t)at_handle.st_size, digest);
  safe_git_secure_zero(bytes, (size_t)at_handle.st_size);
  free(bytes);
  if (memcmp(digest, pin->content_digest, sizeof(digest)) != 0 ||
      fstat(descriptor, &at_handle) != 0 ||
      !stat_snapshot_matches(&pin->snapshot, &at_handle)) {
    safe_git_secure_zero(digest, sizeof(digest));
    (void)close(descriptor);
    return 0;
  }
  safe_git_secure_zero(digest, sizeof(digest));
  *file_descriptor = descriptor;
  return 1;
}

static int installation_atomic_promote_init_stage(int directory_fd,
                                                  int target_present) {
  const char *stage_name =
      installation_artifact_name(INSTALLATION_ARTIFACT_INIT_STAGE);
  const char *init_name =
      installation_artifact_name(INSTALLATION_ARTIFACT_INIT);
#if defined(__APPLE__)
  return renameatx_np(directory_fd, stage_name, directory_fd, init_name,
                      target_present ? RENAME_SWAP : RENAME_EXCL) == 0;
#elif defined(__linux__)
  return syscall(SYS_renameat2, directory_fd, stage_name, directory_fd,
                 init_name,
                 target_present ? RENAME_EXCHANGE : RENAME_NOREPLACE) == 0;
#else
  (void)directory_fd;
  (void)target_present;
  return 0;
#endif
}

static int installation_replace_init_stage(
    struct installation_state_authority *authority) {
  struct installation_artifact_pin *init_pin;
  struct installation_artifact_pin *stage_pin;
  int private_fd;
  int init_fd = -1;
  int stage_fd = -1;
  struct stat target;
  struct stat stage_handle;
  struct stat promoted_snapshot;
  if (authority == NULL || !installation_authority_revalidate(authority)) {
    return 0;
  }
  init_pin = &authority->artifact_pins[INSTALLATION_ARTIFACT_INIT];
  stage_pin = &authority->artifact_pins[INSTALLATION_ARTIFACT_INIT_STAGE];
  if (!init_pin->observed || !stage_pin->observed || !stage_pin->present ||
      !installation_open_pinned_artifact(authority,
                                         INSTALLATION_ARTIFACT_INIT, init_pin,
                                         &init_fd) ||
      !installation_open_pinned_artifact(authority,
                                         INSTALLATION_ARTIFACT_INIT_STAGE,
                                         stage_pin, &stage_fd)) {
    if (init_fd >= 0) (void)close(init_fd);
    if (stage_fd >= 0) (void)close(stage_fd);
    return 0;
  }
  private_fd = authority->nodes[authority->private_index].file_descriptor;
  memset(&target, 0, sizeof(target));
  memset(&stage_handle, 0, sizeof(stage_handle));
  memset(&promoted_snapshot, 0, sizeof(promoted_snapshot));
  if (!installation_atomic_promote_init_stage(private_fd, init_pin->present) ||
      fstat(stage_fd, &stage_handle) != 0 ||
      !installation_artifact_identity_matches(&stage_pin->snapshot,
                                              &stage_handle) ||
      fstatat(private_fd,
              installation_artifact_name(INSTALLATION_ARTIFACT_INIT), &target,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !installation_artifact_identity_matches(&stage_pin->snapshot, &target)) {
    if (init_fd >= 0) (void)close(init_fd);
    (void)close(stage_fd);
    return 0;
  }
  promoted_snapshot = target;
  memset(&target, 0, sizeof(target));
  if (init_pin->present) {
    if (fstatat(private_fd,
                installation_artifact_name(INSTALLATION_ARTIFACT_INIT_STAGE),
                &target, AT_SYMLINK_NOFOLLOW) != 0 ||
        !installation_artifact_identity_matches(&init_pin->snapshot, &target) ||
        unlinkat(private_fd,
                 installation_artifact_name(INSTALLATION_ARTIFACT_INIT_STAGE),
                 0) != 0) {
      if (init_fd >= 0) (void)close(init_fd);
      (void)close(stage_fd);
      return 0;
    }
  } else {
    errno = 0;
    if (fstatat(private_fd,
                installation_artifact_name(INSTALLATION_ARTIFACT_INIT_STAGE),
                &target, AT_SYMLINK_NOFOLLOW) == 0 ||
        errno != ENOENT) {
      (void)close(stage_fd);
      return 0;
    }
  }
  if (fsync(private_fd) != 0 ||
      fstatat(private_fd,
              installation_artifact_name(INSTALLATION_ARTIFACT_INIT),
              &promoted_snapshot, AT_SYMLINK_NOFOLLOW) != 0 ||
      !installation_artifact_identity_matches(&stage_pin->snapshot,
                                              &promoted_snapshot) ||
      !installation_authority_revalidate(authority)) {
    if (init_fd >= 0) (void)close(init_fd);
    (void)close(stage_fd);
    return 0;
  }
  if (init_fd >= 0) (void)close(init_fd);
  (void)close(stage_fd);
  *init_pin = *stage_pin;
  init_pin->snapshot = promoted_snapshot;
  memset(stage_pin, 0, sizeof(*stage_pin));
  stage_pin->observed = 1;
  stage_pin->present = 0;
  return 1;
}

static napi_value replace_installation_identity_init_stage(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (!installation_unwrap_authority_argument(env, info, &authority) ||
      !installation_replace_init_stage(authority) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static int installation_lock_file_admitted(int file_descriptor,
                                           const struct stat *expected) {
  struct stat after;
  memset(&after, 0, sizeof(after));
  return S_ISREG(expected->st_mode) && expected->st_uid == geteuid() &&
         expected->st_gid == getegid() &&
         (((unsigned int)expected->st_mode) & 07777U) == 0600U &&
         expected->st_nlink == 1 && expected->st_size == 0 &&
         fd_has_no_extended_access_control(file_descriptor,
                                           EXPECTED_FILE_KIND_REGULAR_FILE) &&
         fstat(file_descriptor, &after) == 0 &&
         stat_snapshot_matches(expected, &after);
}

static void installation_lock_release(
    struct installation_initialization_lock *lock) {
  if (lock == NULL || lock->closed) return;
  if (lock->file_descriptor >= 0) {
    (void)flock(lock->file_descriptor, LOCK_UN);
    (void)close(lock->file_descriptor);
    lock->file_descriptor = -1;
  }
  lock->closed = 1;
}

static void installation_lock_finalizer(napi_env env, void *data, void *hint) {
  struct installation_initialization_lock *lock =
      (struct installation_initialization_lock *)data;
  (void)env;
  (void)hint;
  installation_lock_release(lock);
  free(lock);
}

/* 0 = integrity failure, 1 = acquired, 2 = busy. */
static int installation_acquire_lock(
    struct installation_state_authority *authority,
    struct installation_initialization_lock **lock_result) {
  static const char lock_name[] = ".installation-identity-v1.lock";
  int private_fd;
  struct stat before;
  struct stat after_path;
  int existed = 0;
  int file_descriptor;
  struct installation_initialization_lock *lock;
  if (authority == NULL || lock_result == NULL ||
      !installation_authority_revalidate(authority)) {
    return 0;
  }
  private_fd = authority->nodes[authority->private_index].file_descriptor;
  memset(&before, 0, sizeof(before));
  memset(&after_path, 0, sizeof(after_path));
  file_descriptor = openat(private_fd, lock_name,
                           O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC |
                               O_NONBLOCK | O_NOCTTY,
                           0600);
  if (file_descriptor < 0 && errno == EEXIST) {
    existed = 1;
    file_descriptor = openat(private_fd, lock_name,
                             O_RDWR | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK |
                                 O_NOCTTY);
  }
  if (file_descriptor < 0 || (!existed && fchmod(file_descriptor, 0600) != 0) ||
      fstat(file_descriptor, &before) != 0 ||
      !installation_lock_file_admitted(file_descriptor, &before) ||
      fstatat(private_fd, lock_name, &after_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after_path) ||
      (!existed && (fsync(file_descriptor) != 0 || fsync(private_fd) != 0)) ||
      !installation_authority_revalidate(authority)) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  errno = 0;
  if (flock(file_descriptor, LOCK_EX | LOCK_NB) != 0) {
    int busy = errno == EWOULDBLOCK || errno == EAGAIN;
    (void)close(file_descriptor);
    return busy ? 2 : 0;
  }
  if (fstat(file_descriptor, &before) != 0 ||
      !installation_lock_file_admitted(file_descriptor, &before) ||
      fstatat(private_fd, lock_name, &after_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after_path) ||
      !installation_authority_revalidate(authority)) {
    (void)flock(file_descriptor, LOCK_UN);
    (void)close(file_descriptor);
    return 0;
  }
  lock = (struct installation_initialization_lock *)calloc(1, sizeof(*lock));
  if (lock == NULL) {
    (void)flock(file_descriptor, LOCK_UN);
    (void)close(file_descriptor);
    return 0;
  }
  lock->file_descriptor = file_descriptor;
  *lock_result = lock;
  return 1;
}

static napi_value acquire_installation_identity_initialization_lock(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  struct installation_initialization_lock *lock = NULL;
  napi_value lock_object;
  int acquired;
  if (!installation_unwrap_authority_argument(env, info, &authority)) {
    return throw_installation_state_authority_unavailable(env);
  }
  acquired = installation_acquire_lock(authority, &lock);
  if (acquired == 2) {
    if (napi_get_null(env, &lock_object) != napi_ok) {
      return throw_installation_state_authority_unavailable(env);
    }
    return lock_object;
  }
  if (acquired != 1 || lock == NULL) {
    return throw_installation_state_authority_unavailable(env);
  }
  if (napi_create_object(env, &lock_object) != napi_ok ||
      napi_wrap(env, lock_object, lock, installation_lock_finalizer, NULL,
                NULL) != napi_ok) {
    installation_lock_release(lock);
    free(lock);
    return throw_installation_state_authority_unavailable(env);
  }
  if (napi_type_tag_object(env, lock_object, &INSTALLATION_LOCK_TYPE_TAG) !=
      napi_ok) {
    installation_lock_release(lock);
    return throw_installation_state_authority_unavailable(env);
  }
  return lock_object;
}

static napi_value release_installation_identity_initialization_lock(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  bool tagged = false;
  struct installation_initialization_lock *lock = NULL;
  napi_value result;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      napi_check_object_type_tag(env, argument, &INSTALLATION_LOCK_TYPE_TAG,
                                 &tagged) != napi_ok ||
      !tagged || napi_unwrap(env, argument, (void **)&lock) != napi_ok ||
      lock == NULL) {
    return throw_installation_state_authority_unavailable(env);
  }
  installation_lock_release(lock);
  if (napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static int installation_directory_exact_entries(
    int directory_file_descriptor, const char *const *expected,
    size_t expected_count) {
  int duplicate_descriptor;
  DIR *directory;
  struct dirent *entry;
  unsigned char seen[8];
  struct stat before;
  struct stat after;
  size_t observed = 0;
  if (expected_count > sizeof(seen)) return 0;
  memset(seen, 0, sizeof(seen));
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (fstat(directory_file_descriptor, &before) != 0) return 0;
  duplicate_descriptor = openat(directory_file_descriptor, ".",
                                O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (duplicate_descriptor < 0) return 0;
  directory = fdopendir(duplicate_descriptor);
  if (directory == NULL) {
    (void)close(duplicate_descriptor);
    return 0;
  }
  errno = 0;
  while ((entry = readdir(directory)) != NULL) {
    size_t index;
    int matched = 0;
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      errno = 0;
      continue;
    }
    for (index = 0; index < expected_count; index += 1) {
      if (strcmp(entry->d_name, expected[index]) == 0 && !seen[index]) {
        seen[index] = 1;
        observed += 1;
        matched = 1;
        break;
      }
    }
    if (!matched) {
      (void)closedir(directory);
      return 0;
    }
    errno = 0;
  }
  if (errno != 0 || closedir(directory) != 0 ||
      fstat(directory_file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after)) {
    return 0;
  }
  return observed == expected_count;
}

static int installation_authority_namespace_shape(
    struct installation_state_authority *authority) {
  static const char *const root_entries[] = {"runtime-state", "provider"};
  static const char *const runtime_entries[] = {"private"};
  static const char *const provider_entries[] = {"acceptance"};
  return authority != NULL && installation_authority_revalidate(authority) &&
         installation_directory_exact_entries(
             authority->nodes[authority->root_index].file_descriptor,
             root_entries, 2) &&
         installation_directory_exact_entries(
             authority->nodes[authority->runtime_state_index].file_descriptor,
             runtime_entries, 1) &&
         installation_directory_exact_entries(
             authority->nodes[authority->provider_index].file_descriptor,
             provider_entries, 1) &&
         installation_authority_revalidate(authority);
}

static int installation_assert_fresh(
    struct installation_state_authority *authority) {
  static const char *const root_entries[] = {"runtime-state", "provider"};
  static const char *const runtime_entries[] = {"private"};
  static const char *const provider_entries[] = {"acceptance"};
  static const char *const private_entries[] = {
      ".installation-identity-v1.lock"};
  int lock_fd;
  struct stat lock_metadata;
  if (authority == NULL || !installation_authority_revalidate(authority) ||
      !installation_directory_exact_entries(
          authority->nodes[authority->root_index].file_descriptor,
          root_entries, 2) ||
      !installation_directory_exact_entries(
          authority->nodes[authority->runtime_state_index].file_descriptor,
          runtime_entries, 1) ||
      !installation_directory_exact_entries(
          authority->nodes[authority->provider_index].file_descriptor,
          provider_entries, 1) ||
      !installation_directory_exact_entries(
          authority->nodes[authority->acceptance_index].file_descriptor, NULL,
          0) ||
      !installation_directory_exact_entries(
          authority->nodes[authority->private_index].file_descriptor,
          private_entries, 1)) {
    return 0;
  }
  lock_fd = openat(authority->nodes[authority->private_index].file_descriptor,
                   private_entries[0],
                   O_RDWR | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK | O_NOCTTY);
  memset(&lock_metadata, 0, sizeof(lock_metadata));
  if (lock_fd < 0 || fstat(lock_fd, &lock_metadata) != 0 ||
      !installation_lock_file_admitted(lock_fd, &lock_metadata) ||
      !installation_authority_revalidate(authority)) {
    if (lock_fd >= 0) (void)close(lock_fd);
    return 0;
  }
  if (close(lock_fd) != 0) {
    lock_fd = -1;
    return 0;
  }
  lock_fd = -1;
  if (!installation_authority_revalidate(authority)) return 0;
  return 1;
}

static napi_value assert_installation_state_authority_fresh(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (!installation_unwrap_authority_argument(env, info, &authority) ||
      !installation_assert_fresh(authority) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static int installation_authority_separated_from_safe_git(
    struct installation_state_authority *authority,
    struct safe_git_descriptor_binding *binding) {
  int targets[3];
  size_t target_index;
  int cursor;
  if (authority == NULL || binding == NULL ||
      !installation_authority_revalidate(authority) ||
      !safe_git_revalidate_binding(binding)) {
    return 0;
  }
  targets[0] = binding->workspace_root_index;
  targets[1] = binding->git_directory_index;
  targets[2] = binding->common_directory_index;
  cursor = authority->root_index;
  while (cursor >= 0) {
    for (target_index = 0; target_index < 3; target_index += 1) {
      int target = targets[target_index];
      if (target < 0 || (size_t)target >= binding->node_count ||
          (authority->nodes[cursor].snapshot.st_dev ==
               binding->nodes[target].snapshot.st_dev &&
           authority->nodes[cursor].snapshot.st_ino ==
               binding->nodes[target].snapshot.st_ino)) {
        return 0;
      }
    }
    cursor = authority->nodes[cursor].parent_index;
  }
  return installation_authority_revalidate(authority) &&
         safe_git_revalidate_binding(binding);
}

static napi_value assert_installation_state_authority_separated_from_safe_git(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 2;
  napi_value arguments[2];
  struct installation_state_authority *authority = NULL;
  struct safe_git_descriptor_binding *binding = NULL;
  bool binding_tagged = false;
  napi_value result;
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      !installation_unwrap_authority(env, arguments[0], &authority) ||
      napi_check_object_type_tag(env, arguments[1], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[1], (void **)&binding) != napi_ok ||
      binding == NULL ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  return result;
}

static int safe_git_create_canonical_path(
    const struct safe_git_descriptor_binding *binding, int node_index,
    char **path_result) {
  int chain[SAFE_GIT_BOUND_NODE_LIMIT];
  size_t chain_length = 0;
  size_t path_length = 1;
  size_t cursor = 0;
  size_t index;
  char *path;
  if (binding == NULL || path_result == NULL || node_index <= 0 ||
      (size_t)node_index >= binding->node_count) {
    return 0;
  }
  while (node_index > 0) {
    size_t component_length;
    if (chain_length >= SAFE_GIT_BOUND_NODE_LIMIT ||
        (size_t)node_index >= binding->node_count) {
      return 0;
    }
    component_length = strlen(binding->nodes[node_index].component);
    if (component_length == 0 || component_length > NAME_MAX ||
        path_length > SAFE_GIT_PATH_LIMIT - component_length -
                          (chain_length == 0 ? 0 : 1)) {
      return 0;
    }
    path_length += component_length + (chain_length == 0 ? 0 : 1);
    chain[chain_length++] = node_index;
    node_index = binding->nodes[node_index].parent_index;
  }
  if (node_index != 0 || path_length > SAFE_GIT_PATH_LIMIT) return 0;
  path = (char *)malloc(path_length + 1);
  if (path == NULL) return 0;
  path[cursor++] = '/';
  for (index = chain_length; index > 0; index -= 1) {
    const char *component = binding->nodes[chain[index - 1]].component;
    size_t component_length = strlen(component);
    if (cursor > 1) path[cursor++] = '/';
    memcpy(path + cursor, component, component_length);
    cursor += component_length;
  }
  path[cursor] = '\0';
  if (cursor != path_length) {
    safe_git_secure_zero(path, path_length);
    free(path);
    return 0;
  }
  *path_result = path;
  return 1;
}

static int installation_path_is_equal_or_descendant(const char *candidate,
                                                     const char *ancestor) {
  size_t ancestor_length;
  if (candidate == NULL || ancestor == NULL) return 0;
  ancestor_length = strlen(ancestor);
  return strcmp(candidate, ancestor) == 0 ||
         (strncmp(candidate, ancestor, ancestor_length) == 0 &&
          candidate[ancestor_length] == '/');
}

static napi_value assert_resolved_installation_state_root_separated_from_safe_git(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  char root[SAFE_GIT_PATH_LIMIT + 1];
  const char *resolver_id = NULL;
  uid_t ignored_uid = 0;
  gid_t ignored_gid = 0;
  char *workspace = NULL;
  char *git_directory = NULL;
  char *common_directory = NULL;
  napi_value result;
  int separated = 0;
  memset(root, 0, sizeof(root));
  if (!safe_git_unwrap_argument(env, info, &binding) ||
      !safe_git_revalidate_binding(binding) ||
      !resolve_installation_state_root(root, &resolver_id, &ignored_uid,
                                       &ignored_gid) ||
      resolver_id == NULL ||
      !safe_git_create_canonical_path(binding, binding->workspace_root_index,
                                      &workspace) ||
      !safe_git_create_canonical_path(binding, binding->git_directory_index,
                                      &git_directory) ||
      !safe_git_create_canonical_path(binding, binding->common_directory_index,
                                      &common_directory) ||
      installation_path_is_equal_or_descendant(root, workspace) ||
      installation_path_is_equal_or_descendant(root, git_directory) ||
      installation_path_is_equal_or_descendant(root, common_directory) ||
      !safe_git_revalidate_binding(binding) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    goto cleanup_resolved_separation;
  }
  separated = 1;

cleanup_resolved_separation:
  safe_git_secure_zero(root, sizeof(root));
  if (workspace != NULL) {
    safe_git_secure_zero(workspace, strlen(workspace));
    free(workspace);
  }
  if (git_directory != NULL) {
    safe_git_secure_zero(git_directory, strlen(git_directory));
    free(git_directory);
  }
  if (common_directory != NULL) {
    safe_git_secure_zero(common_directory, strlen(common_directory));
    free(common_directory);
  }
  if (!separated) return throw_installation_state_authority_unavailable(env);
  return result;
}

static int safe_git_create_canonical_locator(
    const struct safe_git_descriptor_binding *binding, int node_index,
    char **locator) {
  int chain[SAFE_GIT_BOUND_NODE_LIMIT];
  size_t chain_length = 0;
  size_t path_length = 1;
  size_t encoded_length;
  size_t output_length;
  unsigned char path[SAFE_GIT_PATH_LIMIT + 1];
  char *output;
  size_t cursor = 0;
  size_t index;
  static const char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  if (binding == NULL || locator == NULL || node_index <= 0 ||
      (size_t)node_index >= binding->node_count) {
    return 0;
  }
  while (node_index > 0) {
    size_t component_length;
    if (chain_length >= SAFE_GIT_BOUND_NODE_LIMIT ||
        (size_t)node_index >= binding->node_count) {
      return 0;
    }
    component_length = strlen(binding->nodes[node_index].component);
    if (component_length == 0 || component_length > NAME_MAX ||
        path_length > SAFE_GIT_PATH_LIMIT - component_length -
                          (chain_length == 0 ? 0 : 1)) {
      return 0;
    }
    path_length += component_length + (chain_length == 0 ? 0 : 1);
    chain[chain_length++] = node_index;
    node_index = binding->nodes[node_index].parent_index;
  }
  if (node_index != 0 || path_length > SAFE_GIT_PATH_LIMIT) {
    return 0;
  }
  path[cursor++] = '/';
  for (index = chain_length; index > 0; index -= 1) {
    const char *component = binding->nodes[chain[index - 1]].component;
    size_t component_length = strlen(component);
    if (cursor > 1) {
      path[cursor++] = '/';
    }
    memcpy(path + cursor, component, component_length);
    cursor += component_length;
  }
  if (cursor != path_length) {
    safe_git_secure_zero(path, sizeof(path));
    return 0;
  }
  encoded_length = (path_length / 3) * 4 +
                   (path_length % 3 == 0 ? 0 : path_length % 3 + 1);
  if (encoded_length > SIZE_MAX - 11) {
    safe_git_secure_zero(path, sizeof(path));
    return 0;
  }
  output_length = 10 + encoded_length;
  output = (char *)malloc(output_length + 1);
  if (output == NULL) {
    safe_git_secure_zero(path, sizeof(path));
    return 0;
  }
  memcpy(output, "base64url:", 10);
  cursor = 10;
  for (index = 0; index + 3 <= path_length; index += 3) {
    uint32_t value = ((uint32_t)path[index] << 16U) |
                     ((uint32_t)path[index + 1] << 8U) |
                     (uint32_t)path[index + 2];
    output[cursor++] = alphabet[(value >> 18U) & 0x3fU];
    output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
    output[cursor++] = alphabet[(value >> 6U) & 0x3fU];
    output[cursor++] = alphabet[value & 0x3fU];
  }
  if (index < path_length) {
    uint32_t value = (uint32_t)path[index] << 16U;
    output[cursor++] = alphabet[(value >> 18U) & 0x3fU];
    if (index + 1 < path_length) {
      value |= (uint32_t)path[index + 1] << 8U;
      output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
      output[cursor++] = alphabet[(value >> 6U) & 0x3fU];
    } else {
      output[cursor++] = alphabet[(value >> 12U) & 0x3fU];
    }
  }
  output[cursor] = '\0';
  safe_git_secure_zero(path, sizeof(path));
  if (cursor != output_length) {
    safe_git_secure_zero(output, output_length);
    free(output);
    return 0;
  }
  *locator = output;
  return 1;
}

static void safe_git_digest_hex(const unsigned char digest[32], char hex[65]) {
  static const char alphabet[] = "0123456789abcdef";
  size_t index;
  for (index = 0; index < 32; index += 1) {
    hex[index * 2] = alphabet[digest[index] >> 4U];
    hex[index * 2 + 1] = alphabet[digest[index] & 0x0fU];
  }
  hex[64] = '\0';
}

static int safe_git_hmac_message(const unsigned char key[32],
                                 const char *format, const char *first,
                                 const char *second, const char *third,
                                 unsigned char digest[32]) {
  int required;
  char *message;
  if (format == NULL || first == NULL) {
    return 0;
  }
  required = snprintf(NULL, 0, format, first, second, third);
  if (required <= 0 || (size_t)required > SAFE_GIT_PATH_LIMIT * 5) {
    return 0;
  }
  message = (char *)malloc((size_t)required + 1);
  if (message == NULL ||
      snprintf(message, (size_t)required + 1, format, first, second, third) !=
          required) {
    free(message);
    return 0;
  }
  safe_git_hmac_sha256(key, (const unsigned char *)message, (size_t)required,
                       digest);
  safe_git_secure_zero(message, (size_t)required);
  free(message);
  return 1;
}

static int safe_git_read_identity_arguments(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding, unsigned char key[32]) {
  size_t argument_count = 2;
  napi_value arguments[2];
  bool tagged = false;
  bool is_buffer = false;
  void *key_bytes = NULL;
  size_t key_length = 0;
  if (binding == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &tagged) != napi_ok ||
      !tagged || napi_unwrap(env, arguments[0], (void **)binding) != napi_ok ||
      *binding == NULL || napi_is_buffer(env, arguments[1], &is_buffer) != napi_ok ||
      !is_buffer ||
      napi_get_buffer_info(env, arguments[1], &key_bytes, &key_length) != napi_ok ||
      key_bytes == NULL || key_length != 32) {
    return 0;
  }
  memcpy(key, key_bytes, 32);
  return 1;
}

static int safe_git_create_path_identity_result(
    napi_env env, const char *repository_id, const char *worktree_id,
    const char *root_identity, napi_value *result) {
  return napi_create_object(env, result) == napi_ok &&
         safe_git_set_string_property(env, *result, "profile",
                                      "native_safe_git_path_identity_v1") &&
         safe_git_set_string_property(env, *result, "repositoryId",
                                      repository_id) &&
         safe_git_set_string_property(env, *result, "worktreeId", worktree_id) &&
         safe_git_set_string_property(env, *result, "rootIdentity",
                                      root_identity);
}

static int safe_git_create_repository_control_result(
    napi_env env, const struct safe_git_descriptor_binding *binding,
    napi_value *result) {
  const char *object_format;
  const char *worktree_config;
  if (binding == NULL || result == NULL || !binding->repository_control_bound) {
    return 0;
  }
  if (binding->object_format == SAFE_GIT_OBJECT_FORMAT_SHA1) {
    object_format = "sha1";
  } else if (binding->object_format == SAFE_GIT_OBJECT_FORMAT_SHA256) {
    object_format = "sha256";
  } else {
    return 0;
  }
  worktree_config = binding->worktree_config_present ? "verified" : "absent";
  if (!(napi_create_object(env, result) == napi_ok &&
         safe_git_set_string_property(
             env, *result, "profile",
             "native_safe_git_repository_control_v1") &&
         safe_git_set_string_property(env, *result, "objectFormat",
                                      object_format) &&
         safe_git_set_string_property(env, *result, "objectDatabase",
                                      "local_only_verified") &&
         safe_git_set_string_property(env, *result, "refBackend",
                                      "files_verified") &&
         safe_git_set_string_property(env, *result, "repositoryConfig",
                                      "verified") &&
         safe_git_set_string_property(env, *result, "worktreeConfig",
                                      worktree_config))) {
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

static napi_value bind_safe_git_repository_control(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding;
  napi_value result;

  if (!safe_git_unwrap_argument(env, info, &binding)) {
    return throw_safe_git_unavailable(env);
  }
  if (!safe_git_bind_repository_control(binding) ||
      !safe_git_create_repository_control_result(env, binding, &result)) {
    /* Promotion mutates retained authority incrementally. Any failure poisons
     * and releases the whole opaque binding so retry cannot resume from a
     * partial node/absence/snapshot set. */
    safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value derive_safe_git_path_identity(napi_env env,
                                                napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  unsigned char key[32] = {0};
  unsigned char repository_digest[32] = {0};
  unsigned char worktree_digest[32] = {0};
  unsigned char root_digest[32] = {0};
  char repository_hex[65] = {0};
  char worktree_hex[65] = {0};
  char root_hex[65] = {0};
  char repository_id[75] = {0};
  char worktree_id[79] = {0};
  char root_identity[75] = {0};
  char *canonical_common = NULL;
  char *canonical_root = NULL;
  char *canonical_git = NULL;
  napi_value result;
  int success = 0;

  if (!safe_git_read_identity_arguments(env, info, &binding, key) ||
      !binding->repository_control_bound ||
      !safe_git_revalidate_binding(binding) ||
      !safe_git_create_canonical_locator(
          binding, binding->common_directory_index, &canonical_common) ||
      !safe_git_create_canonical_locator(binding, binding->workspace_root_index,
                                         &canonical_root) ||
      !safe_git_create_canonical_locator(binding, binding->git_directory_index,
                                         &canonical_git) ||
      !safe_git_hmac_message(
          key,
          "[\"repository-identity-v1\",{\"canonicalCommonGitDir\":\"%s\"}]",
          canonical_common, NULL, NULL, repository_digest)) {
    goto cleanup;
  }
  safe_git_digest_hex(repository_digest, repository_hex);
  if (snprintf(repository_id, sizeof(repository_id), "repo-hmac-%s",
               repository_hex) != (int)sizeof(repository_id) - 1 ||
      !safe_git_hmac_message(
          key,
          "[\"worktree-identity-v1\",{\"canonicalGitDir\":\"%s\",\"canonicalRoot\":\"%s\",\"repositoryId\":\"%s\"}]",
          canonical_git, canonical_root, repository_id, worktree_digest) ||
      !safe_git_hmac_message(
          key, "[\"root-identity-v1\",{\"canonicalRoot\":\"%s\"}]",
          canonical_root, NULL, NULL, root_digest)) {
    goto cleanup;
  }
  safe_git_digest_hex(worktree_digest, worktree_hex);
  safe_git_digest_hex(root_digest, root_hex);
  if (snprintf(worktree_id, sizeof(worktree_id), "worktree-hmac-%s",
               worktree_hex) != (int)sizeof(worktree_id) - 1 ||
      snprintf(root_identity, sizeof(root_identity), "root-hmac-%s", root_hex) !=
          (int)sizeof(root_identity) - 1 ||
      !safe_git_revalidate_binding(binding) ||
      !safe_git_create_path_identity_result(env, repository_id, worktree_id,
                                            root_identity, &result) ||
      !safe_git_revalidate_binding(binding)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  if (canonical_common != NULL) {
    safe_git_secure_zero(canonical_common, strlen(canonical_common));
    free(canonical_common);
  }
  if (canonical_root != NULL) {
    safe_git_secure_zero(canonical_root, strlen(canonical_root));
    free(canonical_root);
  }
  if (canonical_git != NULL) {
    safe_git_secure_zero(canonical_git, strlen(canonical_git));
    free(canonical_git);
  }
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(repository_digest, sizeof(repository_digest));
  safe_git_secure_zero(worktree_digest, sizeof(worktree_digest));
  safe_git_secure_zero(root_digest, sizeof(root_digest));
  safe_git_secure_zero(repository_hex, sizeof(repository_hex));
  safe_git_secure_zero(worktree_hex, sizeof(worktree_hex));
  safe_git_secure_zero(root_hex, sizeof(root_hex));
  safe_git_secure_zero(repository_id, sizeof(repository_id));
  safe_git_secure_zero(worktree_id, sizeof(worktree_id));
  safe_git_secure_zero(root_identity, sizeof(root_identity));
  if (!success) {
    if (binding != NULL) {
      safe_git_release_binding(binding);
    }
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
      {"openInstallationStateAuthority", NULL,
       open_installation_state_authority, NULL, NULL, NULL, napi_default, NULL},
      {"openTestInstallationStateAuthority", NULL,
       open_test_installation_state_authority, NULL, NULL, NULL, napi_default,
       NULL},
      {"revalidateInstallationStateAuthority", NULL,
       revalidate_installation_state_authority, NULL, NULL, NULL, napi_default,
       NULL},
      {"closeInstallationStateAuthority", NULL,
       close_installation_state_authority, NULL, NULL, NULL, napi_default, NULL},
      {"readInstallationIdentityArtifact", NULL,
       read_installation_identity_artifact, NULL, NULL, NULL, napi_default,
       NULL},
      {"createInstallationIdentityArtifact", NULL,
       create_installation_identity_artifact, NULL, NULL, NULL, napi_default,
       NULL},
      {"replaceInstallationIdentityInitStage", NULL,
       replace_installation_identity_init_stage, NULL, NULL, NULL,
       napi_default, NULL},
      {"acquireInstallationIdentityInitializationLock", NULL,
       acquire_installation_identity_initialization_lock, NULL, NULL, NULL,
       napi_default, NULL},
      {"releaseInstallationIdentityInitializationLock", NULL,
       release_installation_identity_initialization_lock, NULL, NULL, NULL,
       napi_default, NULL},
      {"assertInstallationStateAuthorityFresh", NULL,
       assert_installation_state_authority_fresh, NULL, NULL, NULL,
       napi_default, NULL},
      {"assertInstallationStateAuthoritySeparatedFromSafeGit", NULL,
       assert_installation_state_authority_separated_from_safe_git, NULL, NULL,
       NULL, napi_default, NULL},
      {"assertResolvedInstallationStateRootSeparatedFromSafeGit", NULL,
       assert_resolved_installation_state_root_separated_from_safe_git, NULL,
       NULL, NULL, napi_default, NULL},
      {"getKernelBridgeProfile", NULL, get_kernel_bridge_profile, NULL, NULL,
       NULL, napi_default, NULL},
      {"readPeerCredentials", NULL, read_peer_credentials, NULL, NULL, NULL,
       napi_default, NULL},
      {"resolveInstallationStateRoot", NULL,
       resolve_native_installation_state_root, NULL, NULL, NULL, napi_default,
       NULL},
      {"assertFdHasNoExtendedAccessControl", NULL,
       assert_fd_has_no_extended_access_control, NULL, NULL, NULL, napi_default,
       NULL},
      {"openSafeGitDescriptorBootstrap", NULL,
       open_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default, NULL},
      {"revalidateSafeGitDescriptorBootstrap", NULL,
       revalidate_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default,
       NULL},
      {"bindSafeGitRepositoryControl", NULL,
       bind_safe_git_repository_control, NULL, NULL, NULL, napi_default, NULL},
      {"deriveSafeGitPathIdentity", NULL, derive_safe_git_path_identity, NULL,
       NULL, NULL, napi_default, NULL},
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
