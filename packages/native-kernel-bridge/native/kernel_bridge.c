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
#include "safe_git_runner_internal.h"
#if defined(__linux__)
#include <linux/fs.h>
#include <sys/inotify.h>
#include <sys/ioctl.h>
#include <sys/syscall.h>
#include <sys/vfs.h>
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

#if defined(__GNUC__) || defined(__clang__)
#define SAFE_GIT_MAYBE_UNUSED __attribute__((unused))
#else
#define SAFE_GIT_MAYBE_UNUSED
#endif

#define SAFE_GIT_POINTER_LIMIT ((size_t)4096)
#define SAFE_GIT_PATH_LIMIT ((size_t)4096)
#define SAFE_GIT_BOUND_NODE_LIMIT ((size_t)128)
#define SAFE_GIT_ABSENCE_LIMIT ((size_t)16)
#define SAFE_GIT_CONTROL_FILE_LIMIT ((size_t)16777216)
#define SAFE_GIT_CONFIG_FILE_LIMIT ((size_t)1048576)
#define SAFE_GIT_DIRECTORY_ENTRY_LIMIT ((size_t)16384)
#define SAFE_GIT_DIRECTORY_NAME_BYTES_LIMIT ((size_t)4194304)
#define SAFE_GIT_CONFIG_KEY_LIMIT ((size_t)16384)
#define SAFE_GIT_EXECUTABLE_BINARY_LIMIT ((uint64_t)536870912)
#define SAFE_GIT_EXECUTABLE_NODE_LIMIT ((size_t)128)
#define INSTALLATION_AUTHORITY_NODE_LIMIT ((size_t)128)
#define PROVIDER_EXACT_OBJECT_NODE_LIMIT ((size_t)128)
#define PROVIDER_EXACT_OBJECT_BYTES_LIMIT ((size_t)16777216)
#define SAFE_GIT_EMPTY_HOOKS_DIRECTORY_NAME "safe-git-empty-hooks-v1"

#if defined(__linux__) && !defined(EXT4_SUPER_MAGIC)
#define EXT4_SUPER_MAGIC 0xEF53
#endif

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

struct safe_git_installation_node {
  int file_descriptor;
  int parent_index;
  int managed;
  char component[NAME_MAX + 1];
  struct stat snapshot;
};

struct safe_git_executable_node {
  int file_descriptor;
  int parent_index;
  enum safe_git_bound_kind kind;
  unsigned int platform_file_flags;
  char component[NAME_MAX + 1];
  struct stat snapshot;
};

struct safe_git_executable_binding {
  int bound;
  int test_owner_admission;
  size_t node_count;
  int executable_index;
  struct safe_git_executable_node nodes[SAFE_GIT_EXECUTABLE_NODE_LIMIT];
  struct stat authority_root_identity;
  unsigned char binary_digest[32];
  unsigned char binding_token[32];
  char canonical_path[SAFE_GIT_PATH_LIMIT + 1];
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
  int refs_directory_index;
  int product_refs_directory_index;
  int task_baseline_refs_directory_index;
  int repository_control_bound;
  int worktree_config_present;
  enum safe_git_object_format object_format;
  size_t directory_snapshot_count;
  struct safe_git_directory_snapshot directory_snapshots[2];
  int empty_hooks_bound;
  int empty_hooks_test_authority;
  int test_empty_hooks_race_armed;
  int test_executable_owner_admission_armed;
  size_t empty_hooks_node_count;
  int empty_hooks_state_root_index;
  int empty_hooks_directory_index;
  struct safe_git_installation_node
      empty_hooks_nodes[INSTALLATION_AUTHORITY_NODE_LIMIT];
  struct safe_git_executable_binding executable;
  int version_executed;
};

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

enum installation_test_namespace_race_phase {
  INSTALLATION_TEST_NAMESPACE_RACE_NONE = 0,
  INSTALLATION_TEST_NAMESPACE_RACE_STATIC_SHAPE = 1,
  INSTALLATION_TEST_NAMESPACE_RACE_FRESH_SHAPE = 2,
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
  int empty_hooks_index;
  const char *resolver_id;
  char *canonical_state_root_bytes;
  char owner_identity[64];
  struct installation_artifact_pin artifact_pins[4];
  enum installation_test_namespace_race_phase test_namespace_race_phase;
};

struct installation_initialization_lock {
  int closed;
  int file_descriptor;
};

struct provider_exact_object_node {
  int file_descriptor;
  char component[NAME_MAX + 1];
  struct stat snapshot;
};

struct provider_exact_object_source;

/*
 * Process-local, non-serializable publication authority.  Every root-to-parent
 * descriptor remains open for the lifetime of the object.  The canonical path
 * is retained only inside the native addon so JavaScript cannot substitute a
 * pathname at commit time.
 */
struct provider_exact_object_publisher {
  int closed;
  int test_parent_fsync_failure_armed;
  int test_post_link_parent_change_armed;
  int test_pre_link_parent_aba_armed;
  uid_t expected_owner_uid;
  gid_t expected_owner_gid;
  size_t node_count;
  struct provider_exact_object_node nodes[PROVIDER_EXACT_OBJECT_NODE_LIMIT];
  char canonical_parent_path[PATH_MAX + 1];
  char test_pre_link_parent_aba_peer_path[PATH_MAX + 1];
  struct provider_exact_object_source *outstanding_source;
};

struct provider_exact_object_source {
  int closed;
  int file_descriptor;
  int mutation_watch_descriptor;
  struct provider_exact_object_publisher *publisher;
  napi_ref publisher_reference;
  struct stat snapshot;
  size_t parent_node_count;
  int parent_watch_ids[PROVIDER_EXACT_OBJECT_NODE_LIMIT];
  struct timespec parent_change_times[PROVIDER_EXACT_OBJECT_NODE_LIMIT];
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

static const napi_type_tag PROVIDER_EXACT_OBJECT_PUBLISHER_TYPE_TAG = {
    0xa6484c944afe403bULL,
    0x857a843cad2e7ad1ULL,
};

static const napi_type_tag PROVIDER_EXACT_OBJECT_SOURCE_TYPE_TAG = {
    0x903e47e6958d4afbULL,
    0xbadd1536463dc2f8ULL,
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

static napi_value throw_provider_exact_object_unavailable(napi_env env) {
  return throw_coded_error(
      env, "ERR_PROVIDER_RUNTIME_NATIVE_EXACT_OBJECT_UNAVAILABLE",
      "native exact-object publication is unavailable");
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

static int safe_git_executable_platform_flags(
    int file_descriptor, const struct stat *metadata, unsigned int *flags) {
  if (metadata == NULL || flags == NULL) return 0;
#if defined(__APPLE__)
  (void)file_descriptor;
  *flags = (unsigned int)metadata->st_flags;
  return has_no_dangerous_file_flags(metadata);
#elif defined(__linux__)
  return read_linux_file_flags(file_descriptor, flags) &&
         has_no_dangerous_file_flags(*flags);
#else
  (void)file_descriptor;
  return 0;
#endif
}

static int safe_git_executable_has_no_linux_capability(int file_descriptor) {
#if defined(__linux__)
  errno = 0;
  if (fgetxattr(file_descriptor, "security.capability", NULL, 0) >= 0) {
    return 0;
  }
  return errno == ENODATA;
#else
  (void)file_descriptor;
  return 1;
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
  for (index = binding->executable.node_count; index > 0; index -= 1) {
    struct safe_git_executable_node *node =
        &binding->executable.nodes[index - 1];
    if (node->file_descriptor >= 0) {
      (void)close(node->file_descriptor);
      node->file_descriptor = -1;
    }
  }
  safe_git_secure_zero(&binding->executable,
                       sizeof(binding->executable));
  binding->test_executable_owner_admission_armed = 0;
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
  for (index = binding->empty_hooks_node_count; index > 0; index -= 1) {
    struct safe_git_installation_node *node =
        &binding->empty_hooks_nodes[index - 1];
    if (node->file_descriptor >= 0) {
      (void)close(node->file_descriptor);
      node->file_descriptor = -1;
    }
  }
  binding->empty_hooks_node_count = 0;
  binding->empty_hooks_bound = 0;
  binding->empty_hooks_test_authority = 0;
  binding->test_empty_hooks_race_armed = 0;
  binding->empty_hooks_state_root_index = -1;
  binding->empty_hooks_directory_index = -1;
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
  binding->refs_directory_index = -1;
  binding->product_refs_directory_index = -1;
  binding->task_baseline_refs_directory_index = -1;
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
static int safe_git_revalidate_empty_hooks_binding(
    struct safe_git_descriptor_binding *binding);
static int safe_git_revalidate_executable_binding(
    struct safe_git_descriptor_binding *binding);

static int safe_git_executable_path_is_canonical(const char *path) {
  size_t length;
  size_t cursor;
  if (path == NULL || path[0] != '/') return 0;
  length = strlen(path);
  if (length <= 1 || length > SAFE_GIT_PATH_LIMIT ||
      path[length - 1] == '/') {
    return 0;
  }
#if defined(__APPLE__)
  if (strcmp(path, "/usr/bin/git") == 0) return 0;
#endif
  cursor = 1;
  while (cursor < length) {
    size_t end = cursor;
    while (end < length && path[end] != '/') end += 1;
    if (end == cursor || end - cursor > NAME_MAX ||
        (end - cursor == 1 && path[cursor] == '.') ||
        (end - cursor == 2 && path[cursor] == '.' &&
         path[cursor + 1] == '.')) {
      return 0;
    }
    cursor = end + 1;
  }
  return 1;
}

static void safe_git_release_executable_state(
    struct safe_git_executable_binding *state) {
  size_t index;
  if (state == NULL) return;
  for (index = state->node_count; index > 0; index -= 1) {
    int fd = state->nodes[index - 1].file_descriptor;
    if (fd >= 0) (void)close(fd);
  }
  safe_git_secure_zero(state, sizeof(*state));
}

static int safe_git_executable_node_admitted(
    int fd, const struct stat *metadata, enum safe_git_bound_kind kind,
    int test_owner, unsigned int *platform_flags) {
  int owner_ok;
  unsigned int mode;
  if (metadata == NULL || platform_flags == NULL ||
      !safe_git_kind_matches(metadata, kind)) {
    return 0;
  }
  mode = (unsigned int)metadata->st_mode;
  owner_ok = metadata->st_uid == 0 ||
             (test_owner && metadata->st_uid == geteuid());
  if (!owner_ok || (mode & 0022U) != 0U) {
    if (!(test_owner && kind == SAFE_GIT_BOUND_DIRECTORY &&
          metadata->st_uid == 0 && (mode & S_ISVTX) != 0U &&
          (mode & 0022U) == 0022U)) {
      return 0;
    }
  }
  if (kind == SAFE_GIT_BOUND_REGULAR_FILE &&
      ((mode & 0111U) == 0U || (mode & 06000U) != 0U ||
       metadata->st_nlink != 1 || metadata->st_size <= 0 ||
       (uint64_t)metadata->st_size > SAFE_GIT_EXECUTABLE_BINARY_LIMIT)) {
    return 0;
  }
  return fd_has_no_extended_access_control(fd, safe_git_expected_kind(kind)) &&
         safe_git_executable_platform_flags(fd, metadata, platform_flags) &&
         (kind != SAFE_GIT_BOUND_REGULAR_FILE ||
          safe_git_executable_has_no_linux_capability(fd));
}

static int safe_git_add_executable_node(
    struct safe_git_executable_binding *state, int fd, int parent_index,
    const char *component, enum safe_git_bound_kind kind, int test_owner,
    int *node_index) {
  struct safe_git_executable_node *node;
  struct stat metadata;
  unsigned int flags = 0;
  size_t length = component == NULL ? 0 : strlen(component);
  memset(&metadata, 0, sizeof(metadata));
  if (state == NULL || fd < 0 || node_index == NULL ||
      state->node_count >= SAFE_GIT_EXECUTABLE_NODE_LIMIT ||
      parent_index < -1 ||
      (parent_index >= 0 && (size_t)parent_index >= state->node_count) ||
      length > NAME_MAX || fstat(fd, &metadata) != 0 ||
      !safe_git_executable_node_admitted(fd, &metadata, kind, test_owner,
                                         &flags)) {
    return 0;
  }
  node = &state->nodes[state->node_count];
  memset(node, 0, sizeof(*node));
  node->file_descriptor = fd;
  node->parent_index = parent_index;
  node->kind = kind;
  node->platform_file_flags = flags;
  node->snapshot = metadata;
  if (length > 0) memcpy(node->component, component, length);
  node->component[length] = '\0';
  *node_index = (int)state->node_count;
  state->node_count += 1;
  return 1;
}

static int safe_git_open_executable_path(
    const char *path, int test_owner,
    struct safe_git_executable_binding *state) {
  size_t length;
  size_t cursor;
  int current;
  int fd;
  if (state == NULL || !safe_git_executable_path_is_canonical(path)) return 0;
  memset(state, 0, sizeof(*state));
  fd = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0 || !safe_git_add_executable_node(
                    state, fd, -1, "", SAFE_GIT_BOUND_DIRECTORY,
                    test_owner, &current)) {
    if (fd >= 0) (void)close(fd);
    return 0;
  }
  length = strlen(path);
  cursor = 1;
  while (cursor < length) {
    size_t end = cursor;
    size_t component_length;
    char component[NAME_MAX + 1];
    enum safe_git_bound_kind kind;
    struct stat before;
    struct stat after;
    int child;
    int flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC;
    while (end < length && path[end] != '/') end += 1;
    component_length = end - cursor;
    memcpy(component, path + cursor, component_length);
    component[component_length] = '\0';
    kind = end == length ? SAFE_GIT_BOUND_REGULAR_FILE
                         : SAFE_GIT_BOUND_DIRECTORY;
    memset(&before, 0, sizeof(before));
    memset(&after, 0, sizeof(after));
    if (fstatat(state->nodes[current].file_descriptor, component, &before,
                AT_SYMLINK_NOFOLLOW) != 0 ||
        !safe_git_kind_matches(&before, kind)) {
      safe_git_release_executable_state(state);
      return 0;
    }
    if (kind == SAFE_GIT_BOUND_DIRECTORY) {
      flags |= O_DIRECTORY;
    } else {
      flags |= O_NONBLOCK | O_NOCTTY;
    }
    fd = openat(state->nodes[current].file_descriptor, component, flags);
    if (fd < 0 || fstat(fd, &after) != 0 ||
        (kind == SAFE_GIT_BOUND_DIRECTORY
             ? !safe_git_identity_matches(&before, &after, kind)
             : !stat_snapshot_matches(&before, &after)) ||
        !safe_git_add_executable_node(state, fd, current, component, kind,
                                      test_owner, &child)) {
      if (fd >= 0) (void)close(fd);
      safe_git_release_executable_state(state);
      return 0;
    }
    current = child;
    cursor = end + 1;
  }
  state->bound = 1;
  state->test_owner_admission = test_owner;
  state->executable_index = current;
  memcpy(state->canonical_path, path, length + 1);
  return 1;
}

static int safe_git_constant_time_equal(const unsigned char *left,
                                        const unsigned char *right,
                                        size_t length) {
  unsigned char difference = 0;
  size_t index;
  if (left == NULL || right == NULL) return 0;
  for (index = 0; index < length; index += 1) {
    difference |= (unsigned char)(left[index] ^ right[index]);
  }
  return difference == 0;
}

static int safe_git_hash_executable(
    const struct safe_git_executable_binding *state,
    unsigned char digest[32]) {
  struct safe_git_sha256_context context;
  const struct safe_git_executable_node *node;
  struct stat before;
  struct stat after;
  unsigned char buffer[65536];
  off_t offset = 0;
  int success = 0;
  if (state == NULL || digest == NULL || !state->bound ||
      state->executable_index < 0 ||
      (size_t)state->executable_index >= state->node_count) {
    return 0;
  }
  node = &state->nodes[state->executable_index];
  memset(&context, 0, sizeof(context));
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  memset(buffer, 0, sizeof(buffer));
  if (fstat(node->file_descriptor, &before) != 0 ||
      !stat_snapshot_matches(&node->snapshot, &before) ||
      before.st_size <= 0 ||
      (uint64_t)before.st_size > SAFE_GIT_EXECUTABLE_BINARY_LIMIT) {
    goto cleanup;
  }
  safe_git_sha256_init(&context);
  while (offset < before.st_size) {
    off_t remaining = before.st_size - offset;
    size_t requested = remaining < (off_t)sizeof(buffer)
                           ? (size_t)remaining
                           : sizeof(buffer);
    ssize_t observed;
    do {
      observed = pread(node->file_descriptor, buffer, requested, offset);
    } while (observed < 0 && errno == EINTR);
    if (observed <= 0 || (size_t)observed > requested) goto cleanup;
    safe_git_sha256_update(&context, buffer, (size_t)observed);
    offset += observed;
  }
  {
    unsigned char extra;
    ssize_t observed;
    do {
      observed = pread(node->file_descriptor, &extra, 1, offset);
    } while (observed < 0 && errno == EINTR);
    if (observed != 0) goto cleanup;
  }
  if (fstat(node->file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after)) {
    goto cleanup;
  }
  safe_git_sha256_final(&context, digest);
  success = 1;

cleanup:
  safe_git_secure_zero(&context, sizeof(context));
  safe_git_secure_zero(buffer, sizeof(buffer));
  if (!success) safe_git_secure_zero(digest, 32);
  return success;
}

static int safe_git_executable_node_revalidates(
    const struct safe_git_executable_binding *state, size_t index) {
  const struct safe_git_executable_node *node;
  struct stat at_handle;
  struct stat at_parent;
  unsigned int flags = 0;
  if (state == NULL || index >= state->node_count) return 0;
  node = &state->nodes[index];
  memset(&at_handle, 0, sizeof(at_handle));
  memset(&at_parent, 0, sizeof(at_parent));
  if (node->file_descriptor < 0 ||
      fstat(node->file_descriptor, &at_handle) != 0 ||
      !safe_git_executable_node_admitted(
          node->file_descriptor, &at_handle, node->kind,
          state->test_owner_admission, &flags) ||
      flags != node->platform_file_flags ||
      (node->kind == SAFE_GIT_BOUND_DIRECTORY
           ? !safe_git_identity_matches(&node->snapshot, &at_handle,
                                        node->kind)
           : !stat_snapshot_matches(&node->snapshot, &at_handle))) {
    return 0;
  }
  if (node->parent_index < 0) {
    return index == 0 && node->kind == SAFE_GIT_BOUND_DIRECTORY &&
           node->component[0] == '\0';
  }
  if ((size_t)node->parent_index >= index ||
      state->nodes[node->parent_index].kind != SAFE_GIT_BOUND_DIRECTORY ||
      fstatat(state->nodes[node->parent_index].file_descriptor,
              node->component, &at_parent, AT_SYMLINK_NOFOLLOW) != 0) {
    return 0;
  }
  return node->kind == SAFE_GIT_BOUND_DIRECTORY
             ? safe_git_identity_matches(&node->snapshot, &at_parent,
                                         node->kind)
             : stat_snapshot_matches(&node->snapshot, &at_parent);
}

static int safe_git_revalidate_executable_state(
    const struct safe_git_executable_binding *state) {
  unsigned char digest[32] = {0};
  struct stat namespace_root;
  unsigned int namespace_root_flags = 0;
  size_t index;
  int namespace_root_fd = -1;
  int success = 0;
  memset(&namespace_root, 0, sizeof(namespace_root));
  if (state == NULL || !state->bound || state->node_count < 2 ||
      state->node_count > SAFE_GIT_EXECUTABLE_NODE_LIMIT ||
      state->executable_index != (int)state->node_count - 1 ||
      !safe_git_executable_path_is_canonical(state->canonical_path)) {
    return 0;
  }
  namespace_root_fd =
      open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (namespace_root_fd < 0 || fstat(namespace_root_fd, &namespace_root) != 0 ||
      !safe_git_executable_node_admitted(
          namespace_root_fd, &namespace_root, SAFE_GIT_BOUND_DIRECTORY,
          state->test_owner_admission, &namespace_root_flags) ||
      namespace_root_flags != state->nodes[0].platform_file_flags ||
      !safe_git_identity_matches(&state->nodes[0].snapshot, &namespace_root,
                                 SAFE_GIT_BOUND_DIRECTORY)) {
    goto cleanup;
  }
  (void)close(namespace_root_fd);
  namespace_root_fd = -1;
  for (index = 0; index < state->node_count; index += 1) {
    enum safe_git_bound_kind expected =
        index + 1 == state->node_count ? SAFE_GIT_BOUND_REGULAR_FILE
                                       : SAFE_GIT_BOUND_DIRECTORY;
    if (state->nodes[index].kind != expected ||
        (index == 0 ? state->nodes[index].parent_index != -1
                    : state->nodes[index].parent_index != (int)index - 1) ||
        !safe_git_executable_node_revalidates(state, index)) {
      goto cleanup;
    }
  }
  if (!safe_git_hash_executable(state, digest) ||
      !safe_git_constant_time_equal(digest, state->binary_digest,
                                    sizeof(digest))) {
    goto cleanup;
  }
  success = 1;

cleanup:
  if (namespace_root_fd >= 0) (void)close(namespace_root_fd);
  safe_git_secure_zero(digest, sizeof(digest));
  return success;
}

static int safe_git_revalidate_executable_binding(
    struct safe_git_descriptor_binding *binding) {
  return binding != NULL &&
         (!binding->executable.bound ||
          (binding->empty_hooks_bound &&
           safe_git_revalidate_executable_state(&binding->executable)));
}

static int safe_git_same_file_identity(const struct stat *left,
                                       const struct stat *right) {
  return left != NULL && right != NULL && left->st_dev == right->st_dev &&
         left->st_ino == right->st_ino;
}

static int safe_git_executable_is_separated(
    const struct safe_git_descriptor_binding *binding,
    const struct installation_state_authority *authority,
    const struct safe_git_executable_binding *state) {
  const struct stat *protected_nodes[7];
  size_t protected_count = 0;
  size_t executable_index;
  size_t protected_index;
  if (binding == NULL || authority == NULL || state == NULL || !state->bound ||
      binding->workspace_root_index < 0 ||
      binding->git_directory_index < 0 ||
      binding->common_directory_index < 0 ||
      binding->empty_hooks_state_root_index < 0 ||
      binding->empty_hooks_directory_index < 0 || authority->root_index < 0 ||
      authority->empty_hooks_index < 0 ||
      (size_t)binding->workspace_root_index >= binding->node_count ||
      (size_t)binding->git_directory_index >= binding->node_count ||
      (size_t)binding->common_directory_index >= binding->node_count ||
      (size_t)binding->empty_hooks_state_root_index >=
          binding->empty_hooks_node_count ||
      (size_t)binding->empty_hooks_directory_index >=
          binding->empty_hooks_node_count ||
      (size_t)authority->root_index >= authority->node_count ||
      (size_t)authority->empty_hooks_index >= authority->node_count) {
    return 0;
  }
  protected_nodes[protected_count++] =
      &binding->nodes[binding->workspace_root_index].snapshot;
  protected_nodes[protected_count++] =
      &binding->nodes[binding->git_directory_index].snapshot;
  protected_nodes[protected_count++] =
      &binding->nodes[binding->common_directory_index].snapshot;
  protected_nodes[protected_count++] =
      &binding->empty_hooks_nodes[binding->empty_hooks_state_root_index]
           .snapshot;
  protected_nodes[protected_count++] =
      &binding->empty_hooks_nodes[binding->empty_hooks_directory_index]
           .snapshot;
  protected_nodes[protected_count++] =
      &authority->nodes[authority->root_index].snapshot;
  protected_nodes[protected_count++] =
      &authority->nodes[authority->empty_hooks_index].snapshot;
  for (executable_index = 0; executable_index < state->node_count;
       executable_index += 1) {
    for (protected_index = 0; protected_index < protected_count;
         protected_index += 1) {
      if (safe_git_same_file_identity(
              &state->nodes[executable_index].snapshot,
              protected_nodes[protected_index])) {
        return 0;
      }
    }
  }
  return 1;
}

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
  binding->refs_directory_index = refs_index;
  binding->product_refs_directory_index =
      product_namespace_present ? product_namespace_index : -1;
  binding->task_baseline_refs_directory_index = -1;

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

static int safe_git_remove_exact_absence(
    struct safe_git_descriptor_binding *binding, int parent_index,
    const char *component);

static int safe_git_lease_directory_is_exact(
    const struct safe_git_descriptor_binding *binding, int index) {
  struct stat metadata;
  if (binding == NULL || index < 0 ||
      (size_t)index >= binding->node_count ||
      binding->nodes[index].kind != SAFE_GIT_BOUND_DIRECTORY ||
      fstat(binding->nodes[index].file_descriptor, &metadata) != 0) {
    return 0;
  }
  return metadata.st_uid == geteuid() && metadata.st_gid == getegid() &&
         (metadata.st_mode & 07777U) == 0700U &&
         safe_git_fd_is_owner_safe(binding->nodes[index].file_descriptor,
                                   SAFE_GIT_BOUND_DIRECTORY, &metadata);
}

static SAFE_GIT_MAYBE_UNUSED int safe_git_bind_task_baseline_refs_directory(
    struct safe_git_descriptor_binding *binding) {
  struct stat observed;
  int created_product = 0;
  int created_baselines = 0;
  int product_index;
  int baseline_index;
  if (binding == NULL || binding->closed ||
      !binding->repository_control_bound ||
      binding->refs_directory_index < 0 ||
      (size_t)binding->refs_directory_index >= binding->node_count ||
      !safe_git_revalidate_binding(binding)) {
    return 0;
  }
  product_index = binding->product_refs_directory_index;
  if (product_index < 0) {
    memset(&observed, 0, sizeof(observed));
    if (fstatat(binding->nodes[binding->refs_directory_index].file_descriptor,
                "understand-code", &observed, AT_SYMLINK_NOFOLLOW) == 0 ||
        errno != ENOENT ||
        mkdirat(binding->nodes[binding->refs_directory_index].file_descriptor,
                "understand-code", 0700) != 0 ||
        fsync(binding->nodes[binding->refs_directory_index].file_descriptor) !=
            0 ||
        !safe_git_open_child(binding, binding->refs_directory_index,
                             "understand-code", SAFE_GIT_BOUND_DIRECTORY, 1,
                             &product_index) ||
        !safe_git_lease_directory_is_exact(binding, product_index) ||
        !safe_git_remove_exact_absence(binding,
                                       binding->refs_directory_index,
                                       "understand-code")) {
      return 0;
    }
    created_product = 1;
    binding->product_refs_directory_index = product_index;
  } else if (!safe_git_lease_directory_is_exact(binding, product_index)) {
    return 0;
  }
  baseline_index = binding->task_baseline_refs_directory_index;
  if (baseline_index < 0) {
    memset(&observed, 0, sizeof(observed));
    if (fstatat(binding->nodes[product_index].file_descriptor,
                "task-baselines", &observed, AT_SYMLINK_NOFOLLOW) != 0) {
      if (errno != ENOENT ||
          mkdirat(binding->nodes[product_index].file_descriptor,
                  "task-baselines", 0700) != 0 ||
          fsync(binding->nodes[product_index].file_descriptor) != 0) {
        return 0;
      }
      created_baselines = 1;
    }
    if (!safe_git_open_child(binding, product_index, "task-baselines",
                             SAFE_GIT_BOUND_DIRECTORY, 1, &baseline_index) ||
        !safe_git_lease_directory_is_exact(binding, baseline_index)) {
      return 0;
    }
    binding->task_baseline_refs_directory_index = baseline_index;
  } else if (!safe_git_lease_directory_is_exact(binding, baseline_index)) {
    return 0;
  }
  (void)created_product;
  (void)created_baselines;
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

static int safe_git_remove_exact_absence(
    struct safe_git_descriptor_binding *binding, int parent_index,
    const char *component) {
  size_t index;
  if (binding == NULL || component == NULL) return 0;
  for (index = 0; index < binding->absence_count; index += 1) {
    if (binding->absences[index].parent_index == parent_index &&
        strcmp(binding->absences[index].component, component) == 0) {
      size_t remaining = binding->absence_count - index - 1;
      if (remaining > 0) {
        memmove(&binding->absences[index], &binding->absences[index + 1],
                remaining * sizeof(binding->absences[0]));
      }
      binding->absence_count -= 1;
      memset(&binding->absences[binding->absence_count], 0,
             sizeof(binding->absences[0]));
      return 1;
    }
  }
  return 0;
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
  if (binding->empty_hooks_bound &&
      !safe_git_revalidate_empty_hooks_binding(binding)) {
    return 0;
  }
  return safe_git_revalidate_executable_binding(binding);
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
  binding->refs_directory_index = -1;
  binding->product_refs_directory_index = -1;
  binding->task_baseline_refs_directory_index = -1;
  binding->empty_hooks_state_root_index = -1;
  binding->empty_hooks_directory_index = -1;
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

static int installation_directory_security_admitted_with_entry_churn(
    int file_descriptor) {
  struct stat before;
  struct stat after;
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (fstat(file_descriptor, &before) != 0 || !S_ISDIR(before.st_mode)) {
    return 0;
  }
#if defined(__APPLE__)
  if (!has_no_dangerous_file_flags(&before) ||
      !has_no_extended_access_control(file_descriptor,
                                      EXPECTED_FILE_KIND_DIRECTORY) ||
      fstat(file_descriptor, &after) != 0 ||
      !has_no_dangerous_file_flags(&after) ||
      before.st_flags != after.st_flags ||
      !safe_git_identity_matches(&before, &after,
                                 SAFE_GIT_BOUND_DIRECTORY) ||
      !has_no_extended_access_control(file_descriptor,
                                      EXPECTED_FILE_KIND_DIRECTORY) ||
      fstat(file_descriptor, &after) != 0 ||
      before.st_flags != after.st_flags ||
      !has_no_dangerous_file_flags(&after)) {
    return 0;
  }
#elif defined(__linux__)
  unsigned int flags_before;
  unsigned int flags_after;
  if (!read_linux_file_flags(file_descriptor, &flags_before) ||
      !has_no_dangerous_file_flags(flags_before) ||
      !has_no_extended_access_control(file_descriptor,
                                      EXPECTED_FILE_KIND_DIRECTORY) ||
      !read_linux_file_flags(file_descriptor, &flags_after) ||
      flags_before != flags_after || !has_no_dangerous_file_flags(flags_after) ||
      fstat(file_descriptor, &after) != 0 ||
      !safe_git_identity_matches(&before, &after,
                                 SAFE_GIT_BOUND_DIRECTORY) ||
      !has_no_extended_access_control(file_descriptor,
                                      EXPECTED_FILE_KIND_DIRECTORY) ||
      !read_linux_file_flags(file_descriptor, &flags_after) ||
      flags_before != flags_after || !has_no_dangerous_file_flags(flags_after) ||
      fstat(file_descriptor, &after) != 0) {
    return 0;
  }
#else
  return 0;
#endif
  return safe_git_identity_matches(&before, &after,
                                   SAFE_GIT_BOUND_DIRECTORY);
}

static int installation_directory_admitted(
    int file_descriptor, const struct stat *expected, int managed) {
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
      !installation_directory_security_admitted_with_entry_churn(
          file_descriptor) ||
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
      component_length > NAME_MAX || fstat(file_descriptor, &metadata) != 0) {
    return 0;
  }
  if (!installation_directory_admitted(file_descriptor, &metadata, managed)) {
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

static int installation_directory_exact_entries(
    int directory_file_descriptor, const char *const *expected,
    size_t expected_count);

static int installation_authority_open_empty_hooks(
    struct installation_state_authority *authority, int create_structure) {
  struct stat metadata;
  int created = 0;
  memset(&metadata, 0, sizeof(metadata));
  if (authority == NULL || authority->private_index < 0) return 0;
  if (create_structure) {
    return installation_authority_open_child(
               authority, authority->private_index,
               SAFE_GIT_EMPTY_HOOKS_DIRECTORY_NAME, 1, 1, &created,
               &authority->empty_hooks_index) &&
           created != 0;
  }
  errno = 0;
  if (fstatat(authority->nodes[authority->private_index].file_descriptor,
              SAFE_GIT_EMPTY_HOOKS_DIRECTORY_NAME, &metadata,
              AT_SYMLINK_NOFOLLOW) != 0) {
    return errno == ENOENT;
  }
  return installation_authority_open_child(
             authority, authority->private_index,
             SAFE_GIT_EMPTY_HOOKS_DIRECTORY_NAME, 1, 0, &created,
             &authority->empty_hooks_index) &&
         created == 0;
}

static int installation_authority_namespace_shape(
    struct installation_state_authority *authority);

static int installation_authority_revalidate_chain(
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
  return authority->empty_hooks_index < 0 ||
         ((size_t)authority->empty_hooks_index < authority->node_count &&
          installation_directory_exact_entries(
              authority->nodes[authority->empty_hooks_index].file_descriptor,
              NULL, 0));
}

static int installation_authority_revalidate(
    struct installation_state_authority *authority) {
  return installation_authority_namespace_shape(authority);
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

static void safe_git_digest_hex(const unsigned char digest[32], char hex[65]);

static int safe_git_create_executable_binding_token(
    const struct safe_git_executable_binding *state,
    const unsigned char key[32], unsigned char token[32]) {
  const struct safe_git_executable_node *node;
  char owner[64] = {0};
  char *owner_identity = NULL;
  char digest_hex[65] = {0};
  char message[1024] = {0};
  int message_length;
  int success = 0;
  if (state == NULL || key == NULL || token == NULL || !state->bound ||
      state->executable_index < 0 ||
      (size_t)state->executable_index >= state->node_count) {
    return 0;
  }
  node = &state->nodes[state->executable_index];
  safe_git_digest_hex(state->binary_digest, digest_hex);
  if (snprintf(owner, sizeof(owner), "posix-uid:%" PRIuMAX,
               (uintmax_t)node->snapshot.st_uid) <= 0 ||
      !installation_encode_internal_bytes((const unsigned char *)owner,
                                          strlen(owner), &owner_identity)) {
    goto cleanup;
  }
  message_length = snprintf(
      message, sizeof(message),
      "[\"safe-git-executable-binding-token-v1\",{\"binaryDigest\":\"sha256:%s\",\"fileIdentity\":{\"device\":\"%" PRIuMAX
      "\",\"inode\":\"%" PRIuMAX
      "\",\"platform\":\"posix\"},\"mode\":\"%" PRIuMAX
      "\",\"ownerIdentity\":\"%s\",\"size\":\"%" PRIuMAX "\"}]",
      digest_hex, (uintmax_t)node->snapshot.st_dev,
      (uintmax_t)node->snapshot.st_ino,
      (uintmax_t)(((unsigned int)node->snapshot.st_mode) & 07777U),
      owner_identity, (uintmax_t)node->snapshot.st_size);
  if (message_length <= 0 || (size_t)message_length >= sizeof(message)) {
    goto cleanup;
  }
  safe_git_hmac_sha256(key, (const unsigned char *)message,
                       (size_t)message_length, token);
  success = 1;

cleanup:
  safe_git_secure_zero(owner, sizeof(owner));
  safe_git_secure_zero(digest_hex, sizeof(digest_hex));
  safe_git_secure_zero(message, sizeof(message));
  if (owner_identity != NULL) {
    safe_git_secure_zero(owner_identity, strlen(owner_identity));
    free(owner_identity);
  }
  if (!success) safe_git_secure_zero(token, 32);
  return success;
}

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
  authority->empty_hooks_index = -1;
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
      !installation_authority_open_empty_hooks(authority, create_structure) ||
      !installation_authority_open_managed_child(
          authority, authority->root_index, "provider", create_structure,
          &authority->provider_index) ||
      !installation_authority_open_managed_child(
          authority, authority->provider_index, "acceptance", create_structure,
          &authority->acceptance_index) ||
      !installation_authority_revalidate(authority)) {
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

static int installation_create_posix_identity(napi_env env,
                                              const struct stat *metadata,
                                              napi_value *result) {
  char device[32];
  char inode[32];
  if (metadata == NULL ||
      snprintf(device, sizeof(device), "%" PRIuMAX,
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

static int installation_create_root_identity(
    napi_env env, const struct installation_state_authority *authority,
    napi_value *result) {
  return authority != NULL && authority->root_index >= 0 &&
         (size_t)authority->root_index < authority->node_count &&
         installation_create_posix_identity(
             env, &authority->nodes[authority->root_index].snapshot, result);
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

static int installation_create_empty_hooks_inspection(
    napi_env env, const struct installation_state_authority *authority,
    napi_value *result) {
  napi_value directory_identity;
  if (authority == NULL || authority->empty_hooks_index < 0 ||
      (size_t)authority->empty_hooks_index >= authority->node_count ||
      !installation_create_posix_identity(
          env, &authority->nodes[authority->empty_hooks_index].snapshot,
          &directory_identity) ||
      napi_create_object(env, result) != napi_ok ||
      !safe_git_set_string_property(
          env, *result, "profile",
          "native_installation_empty_hooks_directory_v1") ||
      napi_set_named_property(env, *result, "directoryIdentity",
                              directory_identity) != napi_ok) {
    return 0;
  }
  return 1;
}

static napi_value inspect_installation_empty_hooks_directory(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (!installation_unwrap_authority_argument(env, info, &authority) ||
      !installation_authority_revalidate(authority) ||
      authority->empty_hooks_index < 0 ||
      !installation_create_empty_hooks_inspection(env, authority, &result) ||
      !installation_authority_revalidate(authority)) {
    if (authority != NULL) installation_authority_release(authority);
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
  struct stat after_handle;
  struct stat after_path;
  struct stat after_revalidation;
  int file_descriptor = -1;
  unsigned char *content;
  memset(&before, 0, sizeof(before));
  memset(&after_handle, 0, sizeof(after_handle));
  memset(&after_path, 0, sizeof(after_path));
  memset(&after_revalidation, 0, sizeof(after_revalidation));
  if (authority == NULL || bytes == NULL || length == NULL || present == NULL ||
      snapshot == NULL || digest == NULL || name == NULL ||
      !installation_authority_revalidate(authority)) {
    return 0;
  }
  errno = 0;
  if (fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &before, AT_SYMLINK_NOFOLLOW) != 0) {
    if (errno != ENOENT) return 0;
    if (!installation_authority_revalidate(authority)) {
      return 0;
    }
    errno = 0;
    if (fstatat(authority->nodes[authority->private_index].file_descriptor,
                name, &after_revalidation, AT_SYMLINK_NOFOLLOW) == 0 ||
        errno != ENOENT) {
      return 0;
    }
    *bytes = NULL;
    *length = 0;
    *present = 0;
    memset(snapshot, 0, sizeof(*snapshot));
    memset(digest, 0, 32);
    return 1;
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
      fstat(file_descriptor, &after_handle) != 0 ||
      !stat_snapshot_matches(&before, &after_handle) ||
      fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &after_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after_path)) {
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
  if (!installation_authority_revalidate(authority) ||
      fstatat(authority->nodes[authority->private_index].file_descriptor, name,
              &after_revalidation, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after_revalidation)) {
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

#define INSTALLATION_NAMESPACE_SHAPE_LIMIT ((size_t)5)
#define INSTALLATION_TEST_NAMESPACE_RACE_ENTRY \
  ".native-installation-namespace-race-v1"

struct installation_directory_shape_requirement {
  int node_index;
  const char *const *entries;
  size_t entry_count;
};

static int installation_directory_shape_group_closed(
    struct installation_state_authority *authority,
    const struct installation_directory_shape_requirement *requirements,
    size_t requirement_count) {
  struct stat before[INSTALLATION_NAMESPACE_SHAPE_LIMIT];
  struct stat after;
  size_t index;
  if (authority == NULL || requirements == NULL || requirement_count == 0 ||
      requirement_count > INSTALLATION_NAMESPACE_SHAPE_LIMIT) {
    return 0;
  }
  memset(before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  for (index = 0; index < requirement_count; index += 1) {
    int node_index = requirements[index].node_index;
    if (node_index < 0 || (size_t)node_index >= authority->node_count ||
        fstat(authority->nodes[node_index].file_descriptor, &before[index]) !=
            0) {
      return 0;
    }
  }
  for (index = 0; index < requirement_count; index += 1) {
    int node_index = requirements[index].node_index;
    if (!installation_directory_exact_entries(
            authority->nodes[node_index].file_descriptor,
            requirements[index].entries,
            requirements[index].entry_count)) {
      return 0;
    }
  }
  if (!installation_authority_revalidate_chain(authority)) return 0;
  for (index = 0; index < requirement_count; index += 1) {
    int node_index = requirements[index].node_index;
    memset(&after, 0, sizeof(after));
    if (fstat(authority->nodes[node_index].file_descriptor, &after) != 0 ||
        !stat_snapshot_matches(&before[index], &after)) {
      return 0;
    }
  }
  return 1;
}

static int installation_static_namespace_shape_closed(
    struct installation_state_authority *authority) {
  static const char *const root_entries[] = {"runtime-state", "provider"};
  static const char *const runtime_entries[] = {"private"};
  static const char *const provider_entries[] = {"acceptance"};
  struct installation_directory_shape_requirement requirements[3];
  if (authority == NULL) return 0;
  requirements[0].node_index = authority->root_index;
  requirements[0].entries = root_entries;
  requirements[0].entry_count = 2;
  requirements[1].node_index = authority->runtime_state_index;
  requirements[1].entries = runtime_entries;
  requirements[1].entry_count = 1;
  requirements[2].node_index = authority->provider_index;
  requirements[2].entries = provider_entries;
  requirements[2].entry_count = 1;
  return installation_directory_shape_group_closed(authority, requirements,
                                                   3);
}

static int installation_fresh_namespace_shape_closed(
    struct installation_state_authority *authority) {
  static const char *const root_entries[] = {"runtime-state", "provider"};
  static const char *const runtime_entries[] = {"private"};
  static const char *const provider_entries[] = {"acceptance"};
  static const char *const private_entries[] = {
      ".installation-identity-v1.lock", SAFE_GIT_EMPTY_HOOKS_DIRECTORY_NAME};
  struct installation_directory_shape_requirement requirements[5];
  if (authority == NULL || authority->empty_hooks_index < 0) return 0;
  requirements[0].node_index = authority->root_index;
  requirements[0].entries = root_entries;
  requirements[0].entry_count = 2;
  requirements[1].node_index = authority->runtime_state_index;
  requirements[1].entries = runtime_entries;
  requirements[1].entry_count = 1;
  requirements[2].node_index = authority->provider_index;
  requirements[2].entries = provider_entries;
  requirements[2].entry_count = 1;
  requirements[3].node_index = authority->acceptance_index;
  requirements[3].entries = NULL;
  requirements[3].entry_count = 0;
  requirements[4].node_index = authority->private_index;
  requirements[4].entries = private_entries;
  requirements[4].entry_count = 2;
  return installation_directory_shape_group_closed(authority, requirements,
                                                   5);
}

static int installation_apply_test_namespace_race(
    struct installation_state_authority *authority,
    enum installation_test_namespace_race_phase phase, int directory_index) {
  int file_descriptor = -1;
  int directory_file_descriptor;
  if (authority == NULL ||
      authority->test_namespace_race_phase ==
          INSTALLATION_TEST_NAMESPACE_RACE_NONE ||
      authority->test_namespace_race_phase != phase) {
    return 1;
  }
  authority->test_namespace_race_phase =
      INSTALLATION_TEST_NAMESPACE_RACE_NONE;
  if (authority->resolver_id == NULL ||
      strcmp(authority->resolver_id, "test-explicit-temporary-root-v1") != 0 ||
      directory_index < 0 ||
      (size_t)directory_index >= authority->node_count) {
    return 0;
  }
  directory_file_descriptor =
      authority->nodes[directory_index].file_descriptor;
  file_descriptor =
      openat(directory_file_descriptor, INSTALLATION_TEST_NAMESPACE_RACE_ENTRY,
             O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC |
                 O_NONBLOCK | O_NOCTTY,
             0600);
  if (file_descriptor < 0 || fchmod(file_descriptor, 0600) != 0 ||
      fsync(file_descriptor) != 0) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  if (close(file_descriptor) != 0) return 0;
  return fsync(directory_file_descriptor) == 0;
}

static int installation_authority_namespace_shape(
    struct installation_state_authority *authority) {
  return authority != NULL &&
         installation_authority_revalidate_chain(authority) &&
         installation_static_namespace_shape_closed(authority) &&
         installation_apply_test_namespace_race(
             authority, INSTALLATION_TEST_NAMESPACE_RACE_STATIC_SHAPE,
             authority->root_index) &&
         installation_static_namespace_shape_closed(authority);
}

static int installation_assert_fresh(
    struct installation_state_authority *authority) {
  static const char lock_name[] = ".installation-identity-v1.lock";
  int lock_fd = -1;
  struct stat lock_metadata;
  struct stat lock_at_path;
  memset(&lock_metadata, 0, sizeof(lock_metadata));
  memset(&lock_at_path, 0, sizeof(lock_at_path));
  if (authority == NULL ||
      !installation_fresh_namespace_shape_closed(authority) ||
      !installation_apply_test_namespace_race(
          authority, INSTALLATION_TEST_NAMESPACE_RACE_FRESH_SHAPE,
          authority->private_index)) {
    return 0;
  }
  lock_fd = openat(authority->nodes[authority->private_index].file_descriptor,
                   lock_name,
                   O_RDWR | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK | O_NOCTTY);
  if (lock_fd < 0 || fstat(lock_fd, &lock_metadata) != 0 ||
      !installation_lock_file_admitted(lock_fd, &lock_metadata) ||
      fstatat(authority->nodes[authority->private_index].file_descriptor,
              lock_name, &lock_at_path, AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&lock_metadata, &lock_at_path)) {
    if (lock_fd >= 0) (void)close(lock_fd);
    return 0;
  }
  if (close(lock_fd) != 0) return 0;
  return installation_fresh_namespace_shape_closed(authority);
}

static int installation_read_test_namespace_race_arguments(
    napi_env env, napi_callback_info info,
    struct installation_state_authority **authority,
    enum installation_test_namespace_race_phase *phase) {
  size_t argument_count = 2;
  napi_value arguments[2];
  napi_valuetype phase_type;
  char phase_text[16];
  size_t phase_length = 0;
  if (authority == NULL || phase == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      !installation_unwrap_authority(env, arguments[0], authority) ||
      napi_typeof(env, arguments[1], &phase_type) != napi_ok ||
      phase_type != napi_string ||
      napi_get_value_string_utf8(env, arguments[1], phase_text,
                                 sizeof(phase_text), &phase_length) != napi_ok) {
    return 0;
  }
  if (phase_length == strlen("static_shape") &&
      strcmp(phase_text, "static_shape") == 0) {
    *phase = INSTALLATION_TEST_NAMESPACE_RACE_STATIC_SHAPE;
    return 1;
  }
  if (phase_length == strlen("fresh_shape") &&
      strcmp(phase_text, "fresh_shape") == 0) {
    *phase = INSTALLATION_TEST_NAMESPACE_RACE_FRESH_SHAPE;
    return 1;
  }
  return 0;
}

static napi_value arm_test_installation_state_authority_namespace_race(
    napi_env env, napi_callback_info info) {
  struct installation_state_authority *authority = NULL;
  enum installation_test_namespace_race_phase phase =
      INSTALLATION_TEST_NAMESPACE_RACE_NONE;
  napi_value result;
  if (!installation_read_test_namespace_race_arguments(env, info, &authority,
                                                        &phase) ||
      authority->resolver_id == NULL ||
      strcmp(authority->resolver_id, "test-explicit-temporary-root-v1") != 0 ||
      authority->test_namespace_race_phase !=
          INSTALLATION_TEST_NAMESPACE_RACE_NONE ||
      !installation_authority_namespace_shape(authority) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_installation_state_authority_unavailable(env);
  }
  authority->test_namespace_race_phase = phase;
  return result;
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
  cursor = authority->empty_hooks_index >= 0
               ? authority->empty_hooks_index
               : authority->root_index;
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

static void safe_git_reset_empty_hooks_copy(
    struct safe_git_descriptor_binding *binding) {
  size_t index;
  if (binding == NULL) return;
  for (index = binding->empty_hooks_node_count; index > 0; index -= 1) {
    struct safe_git_installation_node *node =
        &binding->empty_hooks_nodes[index - 1];
    if (node->file_descriptor >= 0) {
      (void)close(node->file_descriptor);
      node->file_descriptor = -1;
    }
  }
  binding->empty_hooks_node_count = 0;
  binding->empty_hooks_bound = 0;
  binding->empty_hooks_test_authority = 0;
  binding->test_empty_hooks_race_armed = 0;
  binding->empty_hooks_state_root_index = -1;
  binding->empty_hooks_directory_index = -1;
}

#define SAFE_GIT_TEST_EMPTY_HOOKS_RACE_ENTRY \
  ".native-safe-git-empty-hooks-race-v1"

static int safe_git_apply_test_empty_hooks_race(
    struct safe_git_descriptor_binding *binding) {
  int directory_file_descriptor;
  int file_descriptor = -1;
  if (binding == NULL || !binding->test_empty_hooks_race_armed) return 1;
  binding->test_empty_hooks_race_armed = 0;
  if (!binding->empty_hooks_test_authority ||
      binding->empty_hooks_directory_index < 0 ||
      (size_t)binding->empty_hooks_directory_index >=
          binding->empty_hooks_node_count) {
    return 0;
  }
  directory_file_descriptor =
      binding->empty_hooks_nodes[binding->empty_hooks_directory_index]
          .file_descriptor;
  file_descriptor =
      openat(directory_file_descriptor, SAFE_GIT_TEST_EMPTY_HOOKS_RACE_ENTRY,
             O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC |
                 O_NONBLOCK | O_NOCTTY,
             0600);
  if (file_descriptor < 0 || fchmod(file_descriptor, 0600) != 0 ||
      fsync(file_descriptor) != 0) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return 0;
  }
  if (close(file_descriptor) != 0) return 0;
  return fsync(directory_file_descriptor) == 0;
}

static int safe_git_revalidate_empty_hooks_binding(
    struct safe_git_descriptor_binding *binding) {
  size_t pass;
  if (binding == NULL || !binding->empty_hooks_bound ||
      binding->empty_hooks_node_count == 0 ||
      binding->empty_hooks_state_root_index < 0 ||
      binding->empty_hooks_directory_index < 0 ||
      (size_t)binding->empty_hooks_state_root_index >=
          binding->empty_hooks_node_count ||
      (size_t)binding->empty_hooks_directory_index >=
          binding->empty_hooks_node_count ||
      binding->node_count == 0 ||
      binding->empty_hooks_nodes[0].snapshot.st_dev !=
          binding->nodes[0].snapshot.st_dev ||
      binding->empty_hooks_nodes[0].snapshot.st_ino !=
          binding->nodes[0].snapshot.st_ino) {
    return 0;
  }
  for (pass = 0; pass < 2; pass += 1) {
    size_t index;
    int cursor;
    int targets[3];
    for (index = 0; index < binding->empty_hooks_node_count; index += 1) {
      struct safe_git_installation_node *node =
          &binding->empty_hooks_nodes[index];
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
        if ((size_t)node->parent_index >= binding->empty_hooks_node_count ||
            fstatat(binding->empty_hooks_nodes[node->parent_index].file_descriptor,
                    node->component, &at_parent, AT_SYMLINK_NOFOLLOW) != 0 ||
            !safe_git_identity_matches(&node->snapshot, &at_parent,
                                       SAFE_GIT_BOUND_DIRECTORY)) {
          return 0;
        }
      } else if (index != 0) {
        return 0;
      }
    }
    targets[0] = binding->workspace_root_index;
    targets[1] = binding->git_directory_index;
    targets[2] = binding->common_directory_index;
    cursor = binding->empty_hooks_directory_index;
    while (cursor >= 0) {
      size_t target_index;
      for (target_index = 0; target_index < 3; target_index += 1) {
        int target = targets[target_index];
        if (target < 0 || (size_t)target >= binding->node_count ||
            (binding->empty_hooks_nodes[cursor].snapshot.st_dev ==
                 binding->nodes[target].snapshot.st_dev &&
             binding->empty_hooks_nodes[cursor].snapshot.st_ino ==
                 binding->nodes[target].snapshot.st_ino)) {
          return 0;
        }
      }
      cursor = binding->empty_hooks_nodes[cursor].parent_index;
    }
    if (!installation_directory_exact_entries(
            binding->empty_hooks_nodes[binding->empty_hooks_directory_index]
                .file_descriptor,
            NULL, 0) ||
        (pass == 0 && !safe_git_apply_test_empty_hooks_race(binding))) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_copy_empty_hooks_authority(
    struct safe_git_descriptor_binding *binding,
    const struct installation_state_authority *authority) {
  int chain[INSTALLATION_AUTHORITY_NODE_LIMIT];
  size_t chain_length = 0;
  int cursor;
  size_t ordinal;
  if (binding == NULL || authority == NULL || binding->empty_hooks_bound ||
      binding->empty_hooks_node_count != 0 || authority->empty_hooks_index < 0 ||
      (size_t)authority->empty_hooks_index >= authority->node_count) {
    return 0;
  }
  cursor = authority->empty_hooks_index;
  while (cursor >= 0) {
    if (chain_length >= INSTALLATION_AUTHORITY_NODE_LIMIT ||
        (size_t)cursor >= authority->node_count) {
      return 0;
    }
    chain[chain_length++] = cursor;
    cursor = authority->nodes[cursor].parent_index;
  }
  if (chain_length == 0 || chain[chain_length - 1] != 0) return 0;
  for (ordinal = 0; ordinal < chain_length; ordinal += 1) {
    int source_index = chain[chain_length - ordinal - 1];
    const struct installation_authority_node *source =
        &authority->nodes[source_index];
    struct safe_git_installation_node *target =
        &binding->empty_hooks_nodes[ordinal];
    struct stat observed;
    int descriptor = openat(source->file_descriptor, ".",
                            O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    memset(&observed, 0, sizeof(observed));
    if (descriptor < 0 || fstat(descriptor, &observed) != 0 ||
        !safe_git_identity_matches(&source->snapshot, &observed,
                                   SAFE_GIT_BOUND_DIRECTORY) ||
        !installation_directory_admitted(descriptor, &observed,
                                         source->managed)) {
      if (descriptor >= 0) (void)close(descriptor);
      safe_git_reset_empty_hooks_copy(binding);
      return 0;
    }
    memset(target, 0, sizeof(*target));
    target->file_descriptor = descriptor;
    target->parent_index = ordinal == 0 ? -1 : (int)ordinal - 1;
    target->managed = source->managed;
    target->snapshot = observed;
    memcpy(target->component, source->component,
           strlen(source->component) + 1);
    binding->empty_hooks_node_count += 1;
    if (source_index == authority->root_index) {
      binding->empty_hooks_state_root_index = (int)ordinal;
    }
    if (source_index == authority->empty_hooks_index) {
      binding->empty_hooks_directory_index = (int)ordinal;
    }
  }
  binding->empty_hooks_test_authority =
      authority->resolver_id != NULL &&
      strcmp(authority->resolver_id, "test-explicit-temporary-root-v1") == 0;
  binding->empty_hooks_bound = 1;
  if (!safe_git_revalidate_empty_hooks_binding(binding)) {
    safe_git_reset_empty_hooks_copy(binding);
    return 0;
  }
  return 1;
}

static int safe_git_empty_hooks_authority_matches(
    const struct safe_git_descriptor_binding *binding,
    const struct installation_state_authority *authority) {
  int chain[INSTALLATION_AUTHORITY_NODE_LIMIT];
  size_t chain_length = 0;
  int cursor;
  size_t ordinal;
  if (binding == NULL || authority == NULL || !binding->empty_hooks_bound ||
      authority->empty_hooks_index < 0 ||
      (size_t)authority->empty_hooks_index >= authority->node_count) {
    return 0;
  }
  cursor = authority->empty_hooks_index;
  while (cursor >= 0) {
    if (chain_length >= INSTALLATION_AUTHORITY_NODE_LIMIT ||
        (size_t)cursor >= authority->node_count) {
      return 0;
    }
    chain[chain_length++] = cursor;
    cursor = authority->nodes[cursor].parent_index;
  }
  if (chain_length != binding->empty_hooks_node_count || chain_length == 0 ||
      chain[chain_length - 1] != 0) {
    return 0;
  }
  for (ordinal = 0; ordinal < chain_length; ordinal += 1) {
    int source_index = chain[chain_length - ordinal - 1];
    const struct installation_authority_node *source =
        &authority->nodes[source_index];
    const struct safe_git_installation_node *retained =
        &binding->empty_hooks_nodes[ordinal];
    if (retained->parent_index !=
            (ordinal == 0 ? -1 : (int)ordinal - 1) ||
        retained->managed != source->managed ||
        strcmp(retained->component, source->component) != 0 ||
        !safe_git_identity_matches(&retained->snapshot, &source->snapshot,
                                   SAFE_GIT_BOUND_DIRECTORY) ||
        (source_index == authority->root_index &&
         binding->empty_hooks_state_root_index != (int)ordinal) ||
        (source_index == authority->empty_hooks_index &&
         binding->empty_hooks_directory_index != (int)ordinal)) {
      return 0;
    }
  }
  return 1;
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

static int safe_git_read_empty_hooks_arguments(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding,
    struct installation_state_authority **authority, unsigned char key[32]) {
  size_t argument_count = 3;
  napi_value arguments[3];
  bool binding_tagged = false;
  bool authority_tagged = false;
  bool is_buffer = false;
  void *key_bytes = NULL;
  size_t key_length = 0;
  if (binding == NULL || authority == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 3 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[0], (void **)binding) != napi_ok ||
      *binding == NULL ||
      napi_check_object_type_tag(env, arguments[1],
                                 &INSTALLATION_AUTHORITY_TYPE_TAG,
                                 &authority_tagged) != napi_ok ||
      !authority_tagged ||
      napi_unwrap(env, arguments[1], (void **)authority) != napi_ok ||
      *authority == NULL ||
      napi_is_buffer(env, arguments[2], &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, arguments[2], &key_bytes, &key_length) !=
          napi_ok ||
      key_bytes == NULL || key_length != 32) {
    return 0;
  }
  memcpy(key, key_bytes, 32);
  return 1;
}

static int safe_git_read_command_request(
    napi_env env, napi_value value,
    struct safe_git_runner_read_request_v1 *request) {
  bool is_buffer = false;
  void *raw_bytes = NULL;
  size_t length = 0;
  const unsigned char *bytes;
  size_t first_length;
  size_t second_length;
  size_t index;
  memset(request, 0, sizeof(*request));
  if (napi_is_buffer(env, value, &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, value, &raw_bytes, &length) != napi_ok ||
      raw_bytes == NULL || length < 6) {
    return 0;
  }
  bytes = (const unsigned char *)raw_bytes;
  first_length = ((size_t)bytes[2] << 8U) | (size_t)bytes[3];
  second_length = ((size_t)bytes[4] << 8U) | (size_t)bytes[5];
  if (bytes[0] != 1 || bytes[1] < 1 || bytes[1] > 16 ||
      first_length > SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 ||
      second_length > sizeof(request->parameter_two) - 1 ||
      length != 6 + first_length + second_length) {
    return 0;
  }
  request->profile = (enum safe_git_runner_read_profile_v1)bytes[1];
  if (((request->profile >= SAFE_GIT_RUNNER_READ_REV_PARSE_SHOW_TOPLEVEL_V1 &&
        request->profile <= SAFE_GIT_RUNNER_READ_LS_FILES_STAGE_V1) ||
       request->profile == SAFE_GIT_RUNNER_READ_LS_IGNORE_FILES_V1 ||
       request->profile ==
           SAFE_GIT_RUNNER_READ_CONFIG_GLOBAL_EXCLUDES_FILE_V1) &&
      (first_length != 0 || second_length != 0)) {
    return 0;
  }
  if ((request->profile ==
           SAFE_GIT_RUNNER_READ_REV_PARSE_BASELINE_COMMIT_V1 ||
       request->profile == SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1 ||
       request->profile == SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1 ||
       request->profile == SAFE_GIT_RUNNER_READ_CAT_FILE_TYPE_V1) &&
      (first_length == 0 || second_length != 0)) {
    return 0;
  }
  if ((request->profile == SAFE_GIT_RUNNER_READ_MERGE_BASE_V1 ||
       request->profile == SAFE_GIT_RUNNER_READ_REV_LIST_AHEAD_BEHIND_V1 ||
       request->profile ==
           SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1) &&
      (first_length == 0 || second_length == 0)) {
    return 0;
  }
  for (index = 0; index < first_length + second_length; index += 1) {
    if (bytes[6 + index] == 0) return 0;
  }
  memcpy(request->parameter_one, bytes + 6, first_length);
  memcpy(request->parameter_two, bytes + 6 + first_length, second_length);
  return 1;
}

static int safe_git_read_command_arguments(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding,
    struct installation_state_authority **authority, unsigned char key[32],
    struct safe_git_runner_read_request_v1 *request) {
  size_t argument_count = 4;
  napi_value arguments[4];
  bool binding_tagged = false;
  bool authority_tagged = false;
  bool is_buffer = false;
  void *key_bytes = NULL;
  size_t key_length = 0;
  if (binding == NULL || authority == NULL || request == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 4 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[0], (void **)binding) != napi_ok ||
      *binding == NULL ||
      napi_check_object_type_tag(env, arguments[1],
                                 &INSTALLATION_AUTHORITY_TYPE_TAG,
                                 &authority_tagged) != napi_ok ||
      !authority_tagged ||
      napi_unwrap(env, arguments[1], (void **)authority) != napi_ok ||
      *authority == NULL ||
      napi_is_buffer(env, arguments[2], &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, arguments[2], &key_bytes, &key_length) !=
          napi_ok ||
      key_bytes == NULL || key_length != 32 ||
      !safe_git_read_command_request(env, arguments[3], request)) {
    return 0;
  }
  memcpy(key, key_bytes, 32);
  return 1;
}

struct safe_git_task_baseline_lease_create_request {
  int operation;
  char task_id[27];
  char baseline_snapshot_id[74];
  char commit[65];
  char marker_nonce[33];
  char marker_content_digest[72];
};

static int safe_git_bytes_are_lower_hex(const unsigned char *bytes,
                                        size_t length) {
  size_t index;
  if (bytes == NULL || length == 0) return 0;
  for (index = 0; index < length; index += 1) {
    if (!((bytes[index] >= (unsigned char)'0' &&
           bytes[index] <= (unsigned char)'9') ||
          (bytes[index] >= (unsigned char)'a' &&
           bytes[index] <= (unsigned char)'f'))) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_task_id_is_valid(const unsigned char *bytes,
                                     size_t length) {
  static const char alphabet[] = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  size_t index;
  if (bytes == NULL || length != 26) return 0;
  for (index = 0; index < length; index += 1) {
    if (strchr(alphabet, (int)bytes[index]) == NULL) return 0;
  }
  return 1;
}

static int safe_git_read_task_baseline_lease_create_request(
    napi_env env, napi_value value,
    struct safe_git_task_baseline_lease_create_request *request) {
  bool is_buffer = false;
  void *raw_bytes = NULL;
  size_t length = 0;
  const unsigned char *bytes;
  size_t lengths[5];
  size_t cursor = 12;
  size_t index;
  if (request == NULL ||
      napi_is_buffer(env, value, &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, value, &raw_bytes, &length) != napi_ok ||
      raw_bytes == NULL || length < 12) {
    return 0;
  }
  memset(request, 0, sizeof(*request));
  bytes = (const unsigned char *)raw_bytes;
  if (bytes[0] != 1 || bytes[1] < 1 || bytes[1] > 3) return 0;
  request->operation = (int)bytes[1];
  for (index = 0; index < 5; index += 1) {
    lengths[index] = ((size_t)bytes[2 + index * 2] << 8U) |
                     (size_t)bytes[3 + index * 2];
    if (lengths[index] > length - cursor) return 0;
    cursor += lengths[index];
  }
  if (cursor != length || lengths[0] != 26 || lengths[1] != 73 ||
      (lengths[2] != 40 && lengths[2] != 64) || lengths[3] != 32 ||
      lengths[4] != 71) {
    return 0;
  }
  cursor = 12;
  if (!safe_git_task_id_is_valid(bytes + cursor, lengths[0])) return 0;
  memcpy(request->task_id, bytes + cursor, lengths[0]);
  cursor += lengths[0];
  if (memcmp(bytes + cursor, "snapshot-", 9) != 0 ||
      !safe_git_bytes_are_lower_hex(bytes + cursor + 9, 64)) {
    return 0;
  }
  memcpy(request->baseline_snapshot_id, bytes + cursor, lengths[1]);
  cursor += lengths[1];
  if (!safe_git_bytes_are_lower_hex(bytes + cursor, lengths[2])) return 0;
  memcpy(request->commit, bytes + cursor, lengths[2]);
  cursor += lengths[2];
  if (!safe_git_bytes_are_lower_hex(bytes + cursor, lengths[3])) return 0;
  memcpy(request->marker_nonce, bytes + cursor, lengths[3]);
  cursor += lengths[3];
  if (memcmp(bytes + cursor, "sha256:", 7) != 0 ||
      !safe_git_bytes_are_lower_hex(bytes + cursor + 7, 64)) {
    return 0;
  }
  memcpy(request->marker_content_digest, bytes + cursor, lengths[4]);
  return 1;
}

static int safe_git_read_task_baseline_lease_create_arguments(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding,
    struct installation_state_authority **authority, unsigned char key[32],
    struct safe_git_task_baseline_lease_create_request *request) {
  size_t argument_count = 4;
  napi_value arguments[4];
  bool binding_tagged = false;
  bool authority_tagged = false;
  bool is_buffer = false;
  void *key_bytes = NULL;
  size_t key_length = 0;
  if (binding == NULL || authority == NULL || request == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 4 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[0], (void **)binding) != napi_ok ||
      *binding == NULL ||
      napi_check_object_type_tag(env, arguments[1],
                                 &INSTALLATION_AUTHORITY_TYPE_TAG,
                                 &authority_tagged) != napi_ok ||
      !authority_tagged ||
      napi_unwrap(env, arguments[1], (void **)authority) != napi_ok ||
      *authority == NULL ||
      napi_is_buffer(env, arguments[2], &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, arguments[2], &key_bytes, &key_length) !=
          napi_ok ||
      key_bytes == NULL || key_length != 32 ||
      !safe_git_read_task_baseline_lease_create_request(env, arguments[3],
                                                        request)) {
    return 0;
  }
  memcpy(key, key_bytes, 32);
  return 1;
}

static int safe_git_read_executable_arguments(
    napi_env env, napi_callback_info info,
    struct safe_git_descriptor_binding **binding,
    struct installation_state_authority **authority, unsigned char key[32],
    char **path) {
  size_t argument_count = 4;
  napi_value arguments[4];
  bool binding_tagged = false;
  bool authority_tagged = false;
  bool is_buffer = false;
  napi_valuetype path_type;
  void *key_bytes = NULL;
  size_t key_length = 0;
  size_t path_length = 0;
  size_t copied = 0;
  char *buffer = NULL;
  if (binding == NULL || authority == NULL || key == NULL || path == NULL ||
      napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 4 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[0], (void **)binding) != napi_ok ||
      *binding == NULL ||
      napi_check_object_type_tag(env, arguments[1],
                                 &INSTALLATION_AUTHORITY_TYPE_TAG,
                                 &authority_tagged) != napi_ok ||
      !authority_tagged ||
      napi_unwrap(env, arguments[1], (void **)authority) != napi_ok ||
      *authority == NULL ||
      napi_is_buffer(env, arguments[2], &is_buffer) != napi_ok || !is_buffer ||
      napi_get_buffer_info(env, arguments[2], &key_bytes, &key_length) !=
          napi_ok ||
      key_bytes == NULL || key_length != 32 ||
      napi_typeof(env, arguments[3], &path_type) != napi_ok ||
      path_type != napi_string ||
      napi_get_value_string_utf8(env, arguments[3], NULL, 0, &path_length) !=
          napi_ok ||
      path_length <= 1 || path_length > SAFE_GIT_PATH_LIMIT) {
    return 0;
  }
  buffer = (char *)malloc(path_length + 1);
  if (buffer == NULL ||
      napi_get_value_string_utf8(env, arguments[3], buffer, path_length + 1,
                                 &copied) != napi_ok ||
      copied != path_length || strlen(buffer) != path_length ||
      !safe_git_executable_path_is_canonical(buffer)) {
    free(buffer);
    return 0;
  }
  memcpy(key, key_bytes, 32);
  *path = buffer;
  return 1;
}

static int safe_git_create_executable_binding_result(napi_env env,
                                                     napi_value *result) {
  return result != NULL && napi_create_object(env, result) == napi_ok &&
         safe_git_set_string_property(
             env, *result, "profile",
             "native_safe_git_executable_binding_v1") &&
         safe_git_set_string_property(env, *result, "executableBinding",
                                      "verified");
}

static int safe_git_create_empty_hooks_binding_result(
    napi_env env, const struct stat *identity, const char *token,
    napi_value *result) {
  napi_value directory_identity;
  return identity != NULL && token != NULL &&
         installation_create_posix_identity(env, identity,
                                            &directory_identity) &&
         napi_create_object(env, result) == napi_ok &&
         safe_git_set_string_property(
             env, *result, "profile",
             "native_safe_git_empty_hooks_binding_v1") &&
         napi_set_named_property(env, *result, "directoryIdentity",
                                 directory_identity) == napi_ok &&
         safe_git_set_string_property(env, *result,
                                      "emptyHooksDirectoryToken", token);
}

static napi_value bind_safe_git_empty_hooks_directory(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  unsigned char key[32] = {0};
  unsigned char digest[32] = {0};
  char digest_hex[65] = {0};
  char token[77] = {0};
  char message[256] = {0};
  const struct stat *identity = NULL;
  napi_value result;
  int message_length;
  int success = 0;
  if (!safe_git_read_empty_hooks_arguments(env, info, &binding, &authority,
                                           key) ||
      binding == NULL || authority == NULL || binding->closed ||
      !binding->repository_control_bound ||
      authority->empty_hooks_index < 0 ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !(binding->empty_hooks_bound
            ? safe_git_empty_hooks_authority_matches(binding, authority)
            : safe_git_copy_empty_hooks_authority(binding, authority)) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  identity = &binding
                  ->empty_hooks_nodes[binding->empty_hooks_directory_index]
                  .snapshot;
  message_length = snprintf(
      message, sizeof(message),
      "[\"empty-hooks-directory-token-v1\",{\"directoryIdentity\":{\"device\":\"%" PRIuMAX
      "\",\"inode\":\"%" PRIuMAX
      "\",\"platform\":\"posix\"},\"entries\":[]}]",
      (uintmax_t)identity->st_dev, (uintmax_t)identity->st_ino);
  if (message_length <= 0 || (size_t)message_length >= sizeof(message)) {
    goto cleanup;
  }
  safe_git_hmac_sha256(key, (const unsigned char *)message,
                       (size_t)message_length, digest);
  safe_git_digest_hex(digest, digest_hex);
  if (snprintf(token, sizeof(token), "hmac-sha256:%s", digest_hex) !=
          (int)sizeof(token) - 1 ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_empty_hooks_binding_result(env, identity, token,
                                                  &result) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(digest, sizeof(digest));
  safe_git_secure_zero(digest_hex, sizeof(digest_hex));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(message, sizeof(message));
  if (!success) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value bind_safe_git_executable(napi_env env,
                                           napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  struct safe_git_executable_binding candidate;
  unsigned char key[32] = {0};
  unsigned char token[32] = {0};
  char *path = NULL;
  napi_value result;
  int test_owner = 0;
  int candidate_active = 0;
  int success = 0;
  memset(&candidate, 0, sizeof(candidate));
  if (!safe_git_read_executable_arguments(env, info, &binding, &authority,
                                          key, &path) ||
      binding == NULL || authority == NULL || binding->closed ||
      !binding->repository_control_bound || !binding->empty_hooks_bound ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !safe_git_empty_hooks_authority_matches(binding, authority) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  if (binding->executable.bound) {
    if (strcmp(binding->executable.canonical_path, path) != 0 ||
        !safe_git_same_file_identity(
            &binding->executable.authority_root_identity,
            &authority->nodes[authority->root_index].snapshot) ||
        !safe_git_create_executable_binding_token(&binding->executable, key,
                                                  token) ||
        !safe_git_constant_time_equal(token,
                                      binding->executable.binding_token,
                                      sizeof(token)) ||
        !safe_git_revalidate_binding(binding) ||
        !installation_authority_revalidate(authority) ||
        !safe_git_create_executable_binding_result(env, &result) ||
        !safe_git_revalidate_binding(binding) ||
        !installation_authority_revalidate(authority)) {
      goto cleanup;
    }
    success = 1;
    goto cleanup;
  }
  test_owner = binding->test_executable_owner_admission_armed;
  binding->test_executable_owner_admission_armed = 0;
  if (test_owner &&
      strcmp(authority->resolver_id, "test-explicit-temporary-root-v1") != 0) {
    goto cleanup;
  }
  if (!safe_git_open_executable_path(path, test_owner, &candidate)) {
    goto cleanup;
  }
  candidate_active = 1;
  candidate.authority_root_identity =
      authority->nodes[authority->root_index].snapshot;
  if (!safe_git_executable_is_separated(binding, authority, &candidate) ||
      !safe_git_hash_executable(&candidate, candidate.binary_digest) ||
      !safe_git_create_executable_binding_token(&candidate, key,
                                                candidate.binding_token) ||
      !safe_git_revalidate_executable_state(&candidate) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  binding->executable = candidate;
  safe_git_secure_zero(&candidate, sizeof(candidate));
  candidate_active = 0;
  if (!safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_executable_binding_result(env, &result) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  if (path != NULL) {
    safe_git_secure_zero(path, strlen(path));
    free(path);
  }
  if (candidate_active) safe_git_release_executable_state(&candidate);
  safe_git_secure_zero(&candidate, sizeof(candidate));
  if (!success) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
}

#if defined(__linux__)
static int safe_git_derive_repository_worktree_ids(
    struct safe_git_descriptor_binding *binding, const unsigned char key[32],
    char repository_id[75], char worktree_id[79]);

struct safe_git_task_baseline_marker_pin {
  int directories[3];
  struct stat directory_snapshots[3];
  int file_descriptor;
  struct stat file_snapshot;
  unsigned char *bytes;
  size_t length;
};

static void safe_git_release_task_baseline_marker_pin(
    struct safe_git_task_baseline_marker_pin *pin) {
  size_t index;
  if (pin == NULL) return;
  if (pin->file_descriptor >= 0) (void)close(pin->file_descriptor);
  for (index = 3; index > 0; index -= 1) {
    if (pin->directories[index - 1] >= 0) {
      (void)close(pin->directories[index - 1]);
    }
  }
  if (pin->bytes != NULL) {
    safe_git_secure_zero(pin->bytes, pin->length);
    free(pin->bytes);
  }
  memset(pin, 0, sizeof(*pin));
  pin->file_descriptor = -1;
  for (index = 0; index < 3; index += 1) pin->directories[index] = -1;
}

static int safe_git_marker_node_is_exact(int descriptor,
                                         const struct stat *metadata,
                                         enum safe_git_bound_kind kind,
                                         mode_t mode) {
  return descriptor >= 0 && metadata != NULL &&
         safe_git_kind_matches(metadata, kind) &&
         metadata->st_uid == geteuid() && metadata->st_gid == getegid() &&
         (metadata->st_mode & 07777U) == mode &&
         (kind != SAFE_GIT_BOUND_REGULAR_FILE || metadata->st_nlink == 1) &&
         safe_git_fd_is_owner_safe(descriptor, kind, metadata);
}

static int safe_git_open_marker_child_exact(
    int parent, const char *component, enum safe_git_bound_kind kind,
    mode_t mode, int *descriptor, struct stat *snapshot) {
  struct stat before;
  struct stat after;
  int flags = O_RDONLY | O_NOFOLLOW | O_CLOEXEC;
  int opened = -1;
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  if (parent < 0 || component == NULL || descriptor == NULL ||
      snapshot == NULL ||
      fstatat(parent, component, &before, AT_SYMLINK_NOFOLLOW) != 0 ||
      !safe_git_kind_matches(&before, kind)) {
    return 0;
  }
  if (kind == SAFE_GIT_BOUND_DIRECTORY) {
    flags |= O_DIRECTORY;
  } else {
    flags |= O_NONBLOCK | O_NOCTTY;
  }
  opened = openat(parent, component, flags);
  if (opened < 0 || fstat(opened, &after) != 0 ||
      !stat_snapshot_matches(&before, &after) ||
      !safe_git_marker_node_is_exact(opened, &after, kind, mode)) {
    if (opened >= 0) (void)close(opened);
    return 0;
  }
  *descriptor = opened;
  *snapshot = after;
  return 1;
}

static int safe_git_open_task_baseline_marker(
    int workspace_root_fd, const char *task_id, const char *marker_nonce,
    struct safe_git_task_baseline_marker_pin *pin) {
  static const char *directories[3] = {
      ".understand-code", ".recovery", "task-baseline-transactions"};
  char marker_name[65];
  struct stat after;
  int parent = workspace_root_fd;
  int formatted;
  size_t index;
  size_t consumed = 0;
  ssize_t amount;
  if (pin == NULL || task_id == NULL || marker_nonce == NULL) return 0;
  memset(pin, 0, sizeof(*pin));
  pin->file_descriptor = -1;
  for (index = 0; index < 3; index += 1) pin->directories[index] = -1;
  formatted = snprintf(marker_name, sizeof(marker_name), "%s-%s.json", task_id,
                       marker_nonce);
  if (formatted <= 0 || (size_t)formatted >= sizeof(marker_name)) return 0;
  for (index = 0; index < 3; index += 1) {
    if (!safe_git_open_marker_child_exact(
            parent, directories[index], SAFE_GIT_BOUND_DIRECTORY, 0700,
            &pin->directories[index], &pin->directory_snapshots[index])) {
      safe_git_release_task_baseline_marker_pin(pin);
      return 0;
    }
    parent = pin->directories[index];
  }
  if (!safe_git_open_marker_child_exact(
          parent, marker_name, SAFE_GIT_BOUND_REGULAR_FILE, 0600,
          &pin->file_descriptor, &pin->file_snapshot) ||
      pin->file_snapshot.st_size <= 0 ||
      (uint64_t)pin->file_snapshot.st_size > (uint64_t)(64U * 1024U * 1024U)) {
    safe_git_release_task_baseline_marker_pin(pin);
    return 0;
  }
  pin->length = (size_t)pin->file_snapshot.st_size;
  pin->bytes = (unsigned char *)malloc(pin->length);
  if (pin->bytes == NULL) {
    safe_git_release_task_baseline_marker_pin(pin);
    return 0;
  }
  while (consumed < pin->length) {
    do {
      amount = pread(pin->file_descriptor, pin->bytes + consumed,
                     pin->length - consumed, (off_t)consumed);
    } while (amount < 0 && errno == EINTR);
    if (amount <= 0) {
      safe_git_release_task_baseline_marker_pin(pin);
      return 0;
    }
    consumed += (size_t)amount;
  }
  memset(&after, 0, sizeof(after));
  if (fstat(pin->file_descriptor, &after) != 0 ||
      !stat_snapshot_matches(&pin->file_snapshot, &after)) {
    safe_git_release_task_baseline_marker_pin(pin);
    return 0;
  }
  return 1;
}

static int safe_git_revalidate_task_baseline_marker(
    int workspace_root_fd, const char *task_id, const char *marker_nonce,
    const struct safe_git_task_baseline_marker_pin *pin) {
  static const char *directories[3] = {
      ".understand-code", ".recovery", "task-baseline-transactions"};
  char marker_name[65];
  struct stat observed;
  int parent = workspace_root_fd;
  int formatted;
  size_t index;
  formatted = snprintf(marker_name, sizeof(marker_name), "%s-%s.json", task_id,
                       marker_nonce);
  if (pin == NULL || formatted <= 0 ||
      (size_t)formatted >= sizeof(marker_name)) {
    return 0;
  }
  for (index = 0; index < 3; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (fstat(pin->directories[index], &observed) != 0 ||
        !stat_snapshot_matches(&pin->directory_snapshots[index], &observed) ||
        fstatat(parent, directories[index], &observed,
                AT_SYMLINK_NOFOLLOW) != 0 ||
        !stat_snapshot_matches(&pin->directory_snapshots[index], &observed)) {
      return 0;
    }
    parent = pin->directories[index];
  }
  memset(&observed, 0, sizeof(observed));
  return fstat(pin->file_descriptor, &observed) == 0 &&
         stat_snapshot_matches(&pin->file_snapshot, &observed) &&
         fstatat(parent, marker_name, &observed, AT_SYMLINK_NOFOLLOW) == 0 &&
         stat_snapshot_matches(&pin->file_snapshot, &observed);
}

static int safe_git_create_lease_plan(
    struct safe_git_descriptor_binding *binding, const unsigned char key[32],
    const struct safe_git_task_baseline_lease_create_request *request,
    char lease_id[33], char ref_name[111], char zero_oid[65],
    char **git_lease_json) {
  char repository_id[75] = {0};
  char worktree_id[79] = {0};
  char preimage[640];
  char digest_hex[65] = {0};
  const char *object_format;
  unsigned char digest[32] = {0};
  int preimage_length;
  int ref_length;
  int json_length;
  char *json = NULL;
  int success = 0;
  if (binding == NULL || request == NULL || lease_id == NULL ||
      ref_name == NULL || zero_oid == NULL || git_lease_json == NULL ||
      !safe_git_derive_repository_worktree_ids(binding, key, repository_id,
                                               worktree_id)) {
    goto cleanup;
  }
  if (binding->object_format == SAFE_GIT_OBJECT_FORMAT_SHA1 &&
      strlen(request->commit) == 40) {
    object_format = "sha1";
  } else if (binding->object_format == SAFE_GIT_OBJECT_FORMAT_SHA256 &&
             strlen(request->commit) == 64) {
    object_format = "sha256";
  } else {
    goto cleanup;
  }
  preimage_length = snprintf(
      preimage, sizeof(preimage),
      "[\"git-lease-v1\",{\"baselineSnapshotId\":\"%s\",\"commit\":\"%s\",\"objectFormat\":\"%s\",\"repositoryId\":\"%s\",\"taskId\":\"%s\",\"worktreeId\":\"%s\"}]",
      request->baseline_snapshot_id, request->commit, object_format,
      repository_id, request->task_id, worktree_id);
  if (preimage_length <= 0 || (size_t)preimage_length >= sizeof(preimage)) {
    goto cleanup;
  }
  installation_sha256_bytes((const unsigned char *)preimage,
                            (size_t)preimage_length, digest);
  safe_git_digest_hex(digest, digest_hex);
  if (snprintf(lease_id, 33, "git-lease:%.22s", digest_hex) != 32) {
    goto cleanup;
  }
  ref_length = snprintf(
      ref_name, 111, "refs/understand-code/task-baselines/%.22s-%s",
      digest_hex, request->marker_nonce);
  if (ref_length <= 0 || ref_length >= 111) goto cleanup;
  memset(zero_oid, '0', strlen(request->commit));
  zero_oid[strlen(request->commit)] = '\0';
  json_length = snprintf(
      NULL, 0,
      "{\"baselineSnapshotId\":\"%s\",\"commit\":\"%s\",\"expectedOldObjectId\":\"%s\",\"leaseId\":\"%s\",\"markerNonce\":\"%s\",\"objectFormat\":\"%s\",\"profile\":\"task_baseline_git_lease_plan_v1\",\"refName\":\"%s\",\"refPreexisting\":false,\"reflogPreexisting\":false,\"reflogRelativePath\":\"logs/%s\",\"repositoryId\":\"%s\",\"taskId\":\"%s\",\"worktreeId\":\"%s\"}",
      request->baseline_snapshot_id, request->commit, zero_oid, lease_id,
      request->marker_nonce, object_format, ref_name, ref_name, repository_id,
      request->task_id, worktree_id);
  if (json_length <= 0 || json_length > 2048) goto cleanup;
  json = (char *)malloc((size_t)json_length + 1);
  if (json == NULL ||
      snprintf(
          json, (size_t)json_length + 1,
          "{\"baselineSnapshotId\":\"%s\",\"commit\":\"%s\",\"expectedOldObjectId\":\"%s\",\"leaseId\":\"%s\",\"markerNonce\":\"%s\",\"objectFormat\":\"%s\",\"profile\":\"task_baseline_git_lease_plan_v1\",\"refName\":\"%s\",\"refPreexisting\":false,\"reflogPreexisting\":false,\"reflogRelativePath\":\"logs/%s\",\"repositoryId\":\"%s\",\"taskId\":\"%s\",\"worktreeId\":\"%s\"}",
          request->baseline_snapshot_id, request->commit, zero_oid, lease_id,
          request->marker_nonce, object_format, ref_name, ref_name,
          repository_id, request->task_id, worktree_id) != json_length) {
    goto cleanup;
  }
  *git_lease_json = json;
  json = NULL;
  success = 1;

cleanup:
  if (json != NULL) {
    safe_git_secure_zero(json, strlen(json));
    free(json);
  }
  safe_git_secure_zero(repository_id, sizeof(repository_id));
  safe_git_secure_zero(worktree_id, sizeof(worktree_id));
  safe_git_secure_zero(preimage, sizeof(preimage));
  safe_git_secure_zero(digest_hex, sizeof(digest_hex));
  safe_git_secure_zero(digest, sizeof(digest));
  return success;
}

static int safe_git_marker_matches_lease_plan(
    const struct safe_git_task_baseline_marker_pin *pin,
    const char *git_lease_json, const char *expected_content_digest) {
  static const char root_middle[] =
      ",\"profile\":\"task_baseline_transaction_intent_v1\",\"providerPlan\":";
  static const char root_suffix[] = ",\"schemaVersion\":1}";
  unsigned char digest[32] = {0};
  char digest_hex[65] = {0};
  char *prefix = NULL;
  size_t prefix_length;
  size_t suffix_length = sizeof(root_suffix) - 1;
  int prefix_size;
  int success = 0;
  if (pin == NULL || pin->bytes == NULL || git_lease_json == NULL ||
      expected_content_digest == NULL) {
    goto cleanup;
  }
  prefix_size = snprintf(NULL, 0, "{\"gitLease\":%s%s", git_lease_json,
                         root_middle);
  if (prefix_size <= 0 || prefix_size > 4096) goto cleanup;
  prefix = (char *)malloc((size_t)prefix_size + 1);
  if (prefix == NULL ||
      snprintf(prefix, (size_t)prefix_size + 1, "{\"gitLease\":%s%s",
               git_lease_json, root_middle) != prefix_size) {
    goto cleanup;
  }
  prefix_length = (size_t)prefix_size;
  installation_sha256_bytes(pin->bytes, pin->length, digest);
  safe_git_digest_hex(digest, digest_hex);
  if (strlen(expected_content_digest) != 71 ||
      memcmp(expected_content_digest, "sha256:", 7) != 0 ||
      !safe_git_constant_time_equal(
          (const unsigned char *)expected_content_digest + 7,
          (const unsigned char *)digest_hex, 64) ||
      pin->length <= prefix_length + suffix_length + 1 ||
      memcmp(pin->bytes, prefix, prefix_length) != 0 ||
      pin->bytes[prefix_length] != (unsigned char)'{' ||
      pin->bytes[pin->length - suffix_length - 1] != (unsigned char)'}' ||
      memcmp(pin->bytes + pin->length - suffix_length, root_suffix,
             suffix_length) != 0) {
    goto cleanup;
  }
  success = 1;

cleanup:
  if (prefix != NULL) {
    safe_git_secure_zero(prefix, strlen(prefix));
    free(prefix);
  }
  safe_git_secure_zero(digest, sizeof(digest));
  safe_git_secure_zero(digest_hex, sizeof(digest_hex));
  return success;
}

static const char *safe_git_lease_ref_component(const char *ref_name) {
  static const char prefix[] = "refs/understand-code/task-baselines/";
  const char *component;
  if (ref_name == NULL || strncmp(ref_name, prefix, sizeof(prefix) - 1) != 0) {
    return NULL;
  }
  component = ref_name + sizeof(prefix) - 1;
  return strlen(component) == 55 ? component : NULL;
}

static int safe_git_lease_ref_is_absent(int baseline_directory_fd,
                                        const char *ref_name) {
  const char *component = safe_git_lease_ref_component(ref_name);
  struct stat observed;
  if (baseline_directory_fd < 0 || component == NULL) return 0;
  memset(&observed, 0, sizeof(observed));
  errno = 0;
  return fstatat(baseline_directory_fd, component, &observed,
                 AT_SYMLINK_NOFOLLOW) != 0 &&
         errno == ENOENT;
}

static int safe_git_lease_reflog_is_absent(int common_directory_fd,
                                           const char *ref_name) {
  static const char *components[4] = {"logs", "refs", "understand-code",
                                      "task-baselines"};
  const char *final_component = safe_git_lease_ref_component(ref_name);
  int opened[4] = {-1, -1, -1, -1};
  int parent = common_directory_fd;
  struct stat observed;
  size_t index;
  int absent = 0;
  if (common_directory_fd < 0 || final_component == NULL) return 0;
  for (index = 0; index < 4; index += 1) {
    memset(&observed, 0, sizeof(observed));
    errno = 0;
    if (fstatat(parent, components[index], &observed,
                AT_SYMLINK_NOFOLLOW) != 0) {
      absent = errno == ENOENT;
      goto cleanup;
    }
    if (!S_ISDIR(observed.st_mode)) goto cleanup;
    opened[index] = openat(parent, components[index],
                           O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (opened[index] < 0 || fstat(opened[index], &observed) != 0 ||
        !safe_git_fd_is_owner_safe(opened[index], SAFE_GIT_BOUND_DIRECTORY,
                                   &observed)) {
      goto cleanup;
    }
    parent = opened[index];
  }
  memset(&observed, 0, sizeof(observed));
  errno = 0;
  absent = fstatat(parent, final_component, &observed,
                   AT_SYMLINK_NOFOLLOW) != 0 &&
           errno == ENOENT;

cleanup:
  for (index = 4; index > 0; index -= 1) {
    if (opened[index - 1] >= 0) (void)close(opened[index - 1]);
  }
  return absent;
}

static int safe_git_lease_ref_equals(int baseline_directory_fd,
                                     const char *ref_name,
                                     const char *object_id) {
  const char *component = safe_git_lease_ref_component(ref_name);
  struct stat before;
  struct stat after;
  unsigned char bytes[66];
  size_t oid_length = object_id == NULL ? 0 : strlen(object_id);
  ssize_t amount;
  int descriptor = -1;
  int success = 0;
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  memset(bytes, 0, sizeof(bytes));
  if (baseline_directory_fd < 0 || component == NULL ||
      (oid_length != 40 && oid_length != 64) ||
      fstatat(baseline_directory_fd, component, &before,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !S_ISREG(before.st_mode) || before.st_nlink != 1 ||
      before.st_size != (off_t)(oid_length + 1)) {
    goto cleanup;
  }
  descriptor = openat(baseline_directory_fd, component,
                      O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_NOCTTY |
                          O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after) ||
      !safe_git_fd_is_owner_safe(descriptor, SAFE_GIT_BOUND_REGULAR_FILE,
                                 &after)) {
    goto cleanup;
  }
  do {
    amount = pread(descriptor, bytes, oid_length + 1, 0);
  } while (amount < 0 && errno == EINTR);
  if (amount != (ssize_t)(oid_length + 1) ||
      memcmp(bytes, object_id, oid_length) != 0 || bytes[oid_length] != '\n' ||
      fstat(descriptor, &after) != 0 ||
      !stat_snapshot_matches(&before, &after) ||
      fstatat(baseline_directory_fd, component, &after,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &after)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  if (descriptor >= 0) (void)close(descriptor);
  safe_git_secure_zero(bytes, sizeof(bytes));
  return success;
}

/*
 * Deletes one transaction ref without asking Git to lock packed-refs. Git's
 * delete path needs a common-directory lock even when packed-refs is absent,
 * which is outside the exact lease namespace Landlock grants. We instead use
 * a held descriptor, compare the expected OID, atomically exchange the entry
 * with a private placeholder, re-check the moved inode/content, and only then
 * unlink both names and fsync the retained parent. Any mismatch restores the
 * exchange and leaves the target untouched.
 */
static int safe_git_delete_lease_ref_exact(
    int baseline_directory_fd, const char *ref_name, const char *object_id,
    const char *marker_nonce) {
  const char *component = safe_git_lease_ref_component(ref_name);
  char tombstone[128];
  struct stat before;
  struct stat original;
  struct stat moved;
  unsigned char bytes[66];
  size_t oid_length = object_id == NULL ? 0 : strlen(object_id);
  ssize_t amount;
  int descriptor = -1;
  int placeholder = -1;
  int exchanged = 0;
  int success = 0;
  int attempt;
  memset(tombstone, 0, sizeof(tombstone));
  if (baseline_directory_fd < 0 || component == NULL ||
      object_id == NULL || marker_nonce == NULL ||
      (oid_length != 40 && oid_length != 64) ||
      !safe_git_lease_ref_equals(baseline_directory_fd, ref_name, object_id)) {
    return 0;
  }
  memset(&before, 0, sizeof(before));
  memset(&original, 0, sizeof(original));
  memset(&moved, 0, sizeof(moved));
  memset(bytes, 0, sizeof(bytes));
  descriptor = openat(baseline_directory_fd, component,
                      O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_NOCTTY |
                          O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &before) != 0 ||
      !S_ISREG(before.st_mode) || before.st_nlink != 1 ||
      !safe_git_fd_is_owner_safe(descriptor, SAFE_GIT_BOUND_REGULAR_FILE,
                                 &before) ||
      flock(descriptor, LOCK_EX | LOCK_NB) != 0) {
    goto cleanup;
  }
  do {
    amount = pread(descriptor, bytes, oid_length + 1, 0);
  } while (amount < 0 && errno == EINTR);
  if (amount != (ssize_t)(oid_length + 1) ||
      memcmp(bytes, object_id, oid_length) != 0 || bytes[oid_length] != '\n' ||
      fstat(descriptor, &original) != 0 ||
      !stat_snapshot_matches(&before, &original) ||
      fstatat(baseline_directory_fd, component, &moved,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !stat_snapshot_matches(&before, &moved)) {
    goto cleanup;
  }
  for (attempt = 0; attempt < 8; attempt += 1) {
    int formatted = snprintf(
        tombstone, sizeof(tombstone), ".uc-lease-delete-%ld-%s-%d",
        (long)getpid(), marker_nonce, attempt);
    if (formatted <= 0 || (size_t)formatted >= sizeof(tombstone)) goto cleanup;
    placeholder = openat(baseline_directory_fd, tombstone,
                         O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC,
                         0600);
    if (placeholder >= 0) break;
    if (errno != EEXIST) goto cleanup;
  }
  if (placeholder < 0 || fsync(placeholder) != 0 ||
      close(placeholder) != 0) {
    placeholder = -1;
    goto cleanup;
  }
  placeholder = -1;
#ifdef SYS_renameat2
#ifdef RENAME_EXCHANGE
  if (syscall(SYS_renameat2, baseline_directory_fd, component,
              baseline_directory_fd, tombstone, RENAME_EXCHANGE) != 0) {
    goto cleanup;
  }
  exchanged = 1;
#else
  goto cleanup;
#endif
#else
  goto cleanup;
#endif
  if (fstatat(baseline_directory_fd, tombstone, &moved,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      original.st_dev != moved.st_dev || original.st_ino != moved.st_ino ||
      original.st_mode != moved.st_mode || original.st_uid != moved.st_uid ||
      original.st_gid != moved.st_gid || original.st_size != moved.st_size ||
      original.st_nlink != moved.st_nlink ||
      !S_ISREG(moved.st_mode) || moved.st_nlink != 1) {
    goto restore;
  }
  descriptor = openat(baseline_directory_fd, tombstone,
                      O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_NOCTTY |
                          O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &moved) != 0 ||
      original.st_dev != moved.st_dev || original.st_ino != moved.st_ino ||
      original.st_mode != moved.st_mode || original.st_uid != moved.st_uid ||
      original.st_gid != moved.st_gid || original.st_size != moved.st_size ||
      original.st_nlink != moved.st_nlink) {
    goto restore;
  }
  memset(bytes, 0, sizeof(bytes));
  do {
    amount = pread(descriptor, bytes, oid_length + 1, 0);
  } while (amount < 0 && errno == EINTR);
  if (amount != (ssize_t)(oid_length + 1) ||
      memcmp(bytes, object_id, oid_length) != 0 || bytes[oid_length] != '\n') {
    goto restore;
  }
  (void)close(descriptor);
  descriptor = -1;
  if (unlinkat(baseline_directory_fd, tombstone, 0) != 0 ||
      unlinkat(baseline_directory_fd, component, 0) != 0 ||
      fsync(baseline_directory_fd) != 0 ||
      !safe_git_lease_ref_is_absent(baseline_directory_fd, ref_name)) {
    goto cleanup;
  }
  exchanged = 0;
  success = 1;
  goto cleanup;

restore:
  if (descriptor >= 0) {
    (void)close(descriptor);
    descriptor = -1;
  }
  if (exchanged) {
#ifdef SYS_renameat2
#ifdef RENAME_EXCHANGE
    (void)syscall(SYS_renameat2, baseline_directory_fd, component,
                  baseline_directory_fd, tombstone, RENAME_EXCHANGE);
#endif
#endif
    exchanged = 0;
  }
  (void)unlinkat(baseline_directory_fd, tombstone, 0);

cleanup:
  if (descriptor >= 0) (void)close(descriptor);
  if (placeholder >= 0) (void)close(placeholder);
  if (!success && !exchanged && tombstone[0] != '\0') {
    (void)unlinkat(baseline_directory_fd, tombstone, 0);
  }
  safe_git_secure_zero(tombstone, sizeof(tombstone));
  safe_git_secure_zero(bytes, sizeof(bytes));
  return success;
}

static int safe_git_version_component_is_valid(const unsigned char *bytes,
                                               size_t start, size_t end) {
  size_t index;
  if (end <= start || (end - start > 1 && bytes[start] == (unsigned char)'0')) {
    return 0;
  }
  for (index = start; index < end; index += 1) {
    if (bytes[index] < (unsigned char)'0' ||
        bytes[index] > (unsigned char)'9') {
      return 0;
    }
  }
  return 1;
}

static int safe_git_version_suffix_byte_is_valid(unsigned char byte) {
  return (byte >= (unsigned char)'A' && byte <= (unsigned char)'Z') ||
         (byte >= (unsigned char)'a' && byte <= (unsigned char)'z') ||
         (byte >= (unsigned char)'0' && byte <= (unsigned char)'9') ||
         byte == (unsigned char)' ' || byte == (unsigned char)'.' ||
         byte == (unsigned char)'_' || byte == (unsigned char)'(' ||
         byte == (unsigned char)')' || byte == (unsigned char)'+' ||
         byte == (unsigned char)'-';
}

static int safe_git_version_stdout_is_valid(const unsigned char *bytes,
                                            size_t length) {
  static const unsigned char prefix[] = "git version ";
  size_t cursor = sizeof(prefix) - 1;
  size_t component_start;
  size_t suffix_start;
  size_t suffix_end;
  size_t index;
  if (bytes == NULL || length <= cursor + 6 ||
      length > SAFE_GIT_RUNNER_VERSION_STDOUT_LIMIT_V1 ||
      bytes[length - 1] != (unsigned char)'\n' ||
      memcmp(bytes, prefix, sizeof(prefix) - 1) != 0) {
    return 0;
  }
  for (index = 0; index + 1 < length; index += 1) {
    if (bytes[index] > 0x7fU || bytes[index] == 0 ||
        bytes[index] == (unsigned char)'\r' ||
        bytes[index] == (unsigned char)'\n') {
      return 0;
    }
  }
  for (index = 0; index < 3; index += 1) {
    component_start = cursor;
    while (cursor + 1 < length && bytes[cursor] >= (unsigned char)'0' &&
           bytes[cursor] <= (unsigned char)'9') {
      cursor += 1;
    }
    if (!safe_git_version_component_is_valid(bytes, component_start, cursor)) {
      return 0;
    }
    if (index < 2) {
      if (cursor + 1 >= length || bytes[cursor] != (unsigned char)'.') return 0;
      cursor += 1;
    }
  }
  if (cursor == length - 1) return 1;
  if (bytes[cursor] == (unsigned char)'.') {
    suffix_start = cursor + 1;
    suffix_end = length - 1;
  } else if (cursor + 3 < length && bytes[cursor] == (unsigned char)' ' &&
             bytes[cursor + 1] == (unsigned char)'(' &&
             bytes[length - 2] == (unsigned char)')') {
    suffix_start = cursor + 2;
    suffix_end = length - 2;
  } else {
    return 0;
  }
  if (suffix_end <= suffix_start || suffix_end - suffix_start > 64 ||
      !((bytes[suffix_start] >= (unsigned char)'A' &&
         bytes[suffix_start] <= (unsigned char)'Z') ||
        (bytes[suffix_start] >= (unsigned char)'a' &&
         bytes[suffix_start] <= (unsigned char)'z') ||
        (bytes[suffix_start] >= (unsigned char)'0' &&
         bytes[suffix_start] <= (unsigned char)'9'))) {
    return 0;
  }
  for (index = suffix_start; index < suffix_end; index += 1) {
    if (!safe_git_version_suffix_byte_is_valid(bytes[index])) return 0;
  }
  return 1;
}
#endif

static napi_value execute_safe_git_version(napi_env env,
                                           napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  unsigned char key[32] = {0};
  unsigned char token[32] = {0};
#if defined(__linux__)
  struct safe_git_runner_version_result_v1 execution;
  struct safe_git_executable_node *executable = NULL;
  napi_value result = NULL;
  int success = 0;

  memset(&execution, 0, sizeof(execution));
  if (!safe_git_read_empty_hooks_arguments(env, info, &binding, &authority,
                                           key) ||
      binding == NULL || authority == NULL || binding->closed ||
      !binding->repository_control_bound ||
      !binding->empty_hooks_bound || !binding->executable.bound ||
      binding->executable.executable_index < 0 ||
      (size_t)binding->executable.executable_index >=
          binding->executable.node_count ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !safe_git_empty_hooks_authority_matches(binding, authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token,
                                    binding->executable.binding_token,
                                    sizeof(token)) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  executable = &binding->executable.nodes[
      binding->executable.executable_index];
  if (executable->kind != SAFE_GIT_BOUND_REGULAR_FILE ||
      !safe_git_run_linux_version_v1(
          executable->file_descriptor, binding->executable.canonical_path,
          &execution) ||
      execution.status != SAFE_GIT_RUNNER_STATUS_OK_V1 ||
      execution.stdout_length == 0 ||
      execution.stdout_length > SAFE_GIT_RUNNER_VERSION_STDOUT_LIMIT_V1 ||
      !safe_git_version_stdout_is_valid(execution.stdout_bytes,
                                        execution.stdout_length) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token,
                                    binding->executable.binding_token,
                                    sizeof(token)) ||
      napi_create_buffer_copy(env, execution.stdout_length,
                              execution.stdout_bytes, NULL, &result) !=
          napi_ok ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  binding->version_executed = 1;
  success = 1;

cleanup:
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(&execution, sizeof(execution));
  if (!success) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
#else
  (void)authority;
  if (safe_git_read_empty_hooks_arguments(env, info, &binding, &authority,
                                          key) &&
      binding != NULL) {
    safe_git_release_binding(binding);
  }
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  return throw_safe_git_unavailable(env);
#endif
}

#if defined(__linux__)
static int safe_git_read_request_matches_object_format(
    const struct safe_git_descriptor_binding *binding,
    const struct safe_git_runner_read_request_v1 *request) {
  int first_oid = 0;
  int second_oid = 0;
  if (binding == NULL || request == NULL ||
      (binding->object_format != SAFE_GIT_OBJECT_FORMAT_SHA1 &&
       binding->object_format != SAFE_GIT_OBJECT_FORMAT_SHA256)) {
    return 0;
  }
  switch (request->profile) {
    case SAFE_GIT_RUNNER_READ_MERGE_BASE_V1:
    case SAFE_GIT_RUNNER_READ_REV_LIST_AHEAD_BEHIND_V1:
    case SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1:
      first_oid = 1;
      second_oid = 1;
      break;
    case SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1:
    case SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1:
      first_oid = 1;
      break;
    default:
      break;
  }
  return (!first_oid ||
          safe_git_oid_bytes_are_valid(
              (const unsigned char *)request->parameter_one,
              strlen(request->parameter_one), binding->object_format)) &&
         (!second_oid ||
          safe_git_oid_bytes_are_valid(
              (const unsigned char *)request->parameter_two,
              strlen(request->parameter_two), binding->object_format));
}

static int safe_git_create_read_execution_result(
    napi_env env, const struct safe_git_runner_read_result_v1 *execution,
    napi_value *result) {
  napi_value stdout_value;
  napi_value stderr_value;
  napi_value exit_code_value;
  static const unsigned char empty = 0;
  return execution != NULL && result != NULL &&
         execution->status == SAFE_GIT_RUNNER_STATUS_OK_V1 &&
         execution->stdout_bytes != NULL && execution->stdout_length <=
             SAFE_GIT_RUNNER_READ_STDOUT_LIMIT_V1 &&
         napi_create_buffer_copy(env, execution->stdout_length,
                                 execution->stdout_bytes, NULL,
                                 &stdout_value) == napi_ok &&
         napi_create_buffer_copy(env, 0, &empty, NULL, &stderr_value) ==
             napi_ok &&
         napi_create_int32(env, execution->exit_code, &exit_code_value) ==
             napi_ok &&
         napi_create_object(env, result) == napi_ok &&
         napi_set_named_property(env, *result, "stdout", stdout_value) ==
             napi_ok &&
         napi_set_named_property(env, *result, "stderr", stderr_value) ==
             napi_ok &&
         napi_set_named_property(env, *result, "exitCode", exit_code_value) ==
             napi_ok;
}
#endif

static napi_value execute_safe_git_read_profile(napi_env env,
                                                napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  struct safe_git_runner_read_request_v1 request;
  unsigned char key[32] = {0};
  unsigned char token[32] = {0};
#if defined(__linux__)
  struct safe_git_runner_read_result_v1 execution;
  struct safe_git_executable_node *executable = NULL;
  napi_value result = NULL;
  int success = 0;
  int workspace_fd;
  int git_directory_fd;
  int common_directory_fd;
  int empty_hooks_fd;

  memset(&request, 0, sizeof(request));
  memset(&execution, 0, sizeof(execution));
  execution.status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  execution.exit_code = -1;
  if (!safe_git_read_command_arguments(env, info, &binding, &authority, key,
                                       &request) ||
      binding == NULL || authority == NULL || binding->closed ||
      !binding->repository_control_bound || !binding->empty_hooks_bound ||
      !binding->executable.bound || !binding->version_executed ||
      binding->workspace_root_index < 0 ||
      binding->git_directory_index < 0 || binding->common_directory_index < 0 ||
      binding->empty_hooks_directory_index < 0 ||
      binding->executable.executable_index < 0 ||
      (size_t)binding->workspace_root_index >= binding->node_count ||
      (size_t)binding->git_directory_index >= binding->node_count ||
      (size_t)binding->common_directory_index >= binding->node_count ||
      (size_t)binding->empty_hooks_directory_index >=
          binding->empty_hooks_node_count ||
      (size_t)binding->executable.executable_index >=
          binding->executable.node_count ||
      !safe_git_read_request_matches_object_format(binding, &request) ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !safe_git_empty_hooks_authority_matches(binding, authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token,
                                    binding->executable.binding_token,
                                    sizeof(token)) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  executable = &binding->executable.nodes[
      binding->executable.executable_index];
  workspace_fd = binding->nodes[binding->workspace_root_index].file_descriptor;
  git_directory_fd =
      binding->nodes[binding->git_directory_index].file_descriptor;
  common_directory_fd =
      binding->nodes[binding->common_directory_index].file_descriptor;
  empty_hooks_fd =
      binding->empty_hooks_nodes[binding->empty_hooks_directory_index]
          .file_descriptor;
  if (executable->kind != SAFE_GIT_BOUND_REGULAR_FILE ||
      !safe_git_run_linux_read_v1(
          executable->file_descriptor, binding->executable.canonical_path,
          workspace_fd, git_directory_fd, common_directory_fd, empty_hooks_fd,
          &request, &execution) ||
      execution.status != SAFE_GIT_RUNNER_STATUS_OK_V1 ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token,
                                    binding->executable.binding_token,
                                    sizeof(token)) ||
      !safe_git_create_read_execution_result(env, &execution, &result) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(&request, sizeof(request));
  safe_git_release_linux_read_result_v1(&execution);
  if (!success) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
#else
  (void)authority;
  memset(&request, 0, sizeof(request));
  if (safe_git_read_command_arguments(env, info, &binding, &authority, key,
                                      &request) &&
      binding != NULL) {
    safe_git_release_binding(binding);
  }
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(&request, sizeof(request));
  return throw_safe_git_unavailable(env);
#endif
}

static SAFE_GIT_MAYBE_UNUSED int safe_git_create_task_baseline_lease_result(
    napi_env env, const char *lease_id, const char *ref_name,
    const char *object_id, const char *resolution, napi_value *result) {
  return result != NULL && napi_create_object(env, result) == napi_ok &&
         safe_git_set_string_property(env, *result, "resolution",
                                      resolution) &&
         safe_git_set_string_property(env, *result, "leaseId", lease_id) &&
         safe_git_set_string_property(env, *result, "refName", ref_name) &&
         safe_git_set_string_property(env, *result, "objectId", object_id);
}

static napi_value create_safe_git_task_baseline_lease(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  struct safe_git_task_baseline_lease_create_request request;
  unsigned char key[32] = {0};
  unsigned char token[32] = {0};
#if defined(__linux__)
  struct safe_git_task_baseline_marker_pin marker;
  struct safe_git_runner_read_request_v1 read_request;
  struct safe_git_runner_read_result_v1 read_execution;
  struct safe_git_runner_lease_request_v1 lease_request;
  struct safe_git_runner_lease_result_v1 lease_execution;
  struct safe_git_executable_node *executable = NULL;
  char lease_id[33] = {0};
  char ref_name[111] = {0};
  char zero_oid[65] = {0};
  char *git_lease_json = NULL;
  napi_value result = NULL;
  int workspace_fd;
  int git_directory_fd;
  int common_directory_fd;
  int empty_hooks_fd;
  int baseline_directory_fd;
  int ref_absent;
  int ref_equal;
  int execute_mutation = 1;
  int runner_ok = 1;
  const char *resolution = "created";
  int success = 0;
  size_t commit_length;

  memset(&request, 0, sizeof(request));
  memset(&marker, 0, sizeof(marker));
  marker.file_descriptor = -1;
  marker.directories[0] = -1;
  marker.directories[1] = -1;
  marker.directories[2] = -1;
  memset(&read_request, 0, sizeof(read_request));
  memset(&read_execution, 0, sizeof(read_execution));
  read_execution.status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  read_execution.exit_code = -1;
  memset(&lease_request, 0, sizeof(lease_request));
  memset(&lease_execution, 0, sizeof(lease_execution));
  lease_execution.status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  lease_execution.exit_code = -1;
  if (!safe_git_read_task_baseline_lease_create_arguments(
          env, info, &binding, &authority, key, &request) ||
      binding == NULL || authority == NULL || binding->closed ||
      !binding->repository_control_bound || !binding->empty_hooks_bound ||
      !binding->executable.bound || !binding->version_executed ||
      binding->workspace_root_index < 0 ||
      binding->git_directory_index < 0 || binding->common_directory_index < 0 ||
      binding->empty_hooks_directory_index < 0 ||
      binding->executable.executable_index < 0 ||
      (size_t)binding->workspace_root_index >= binding->node_count ||
      (size_t)binding->git_directory_index >= binding->node_count ||
      (size_t)binding->common_directory_index >= binding->node_count ||
      (size_t)binding->empty_hooks_directory_index >=
          binding->empty_hooks_node_count ||
      (size_t)binding->executable.executable_index >=
          binding->executable.node_count ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !safe_git_empty_hooks_authority_matches(binding, authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token,
                                    binding->executable.binding_token,
                                    sizeof(token)) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_lease_plan(binding, key, &request, lease_id, ref_name,
                                  zero_oid, &git_lease_json)) {
    goto cleanup;
  }
  executable = &binding->executable.nodes[
      binding->executable.executable_index];
  workspace_fd = binding->nodes[binding->workspace_root_index].file_descriptor;
  git_directory_fd =
      binding->nodes[binding->git_directory_index].file_descriptor;
  common_directory_fd =
      binding->nodes[binding->common_directory_index].file_descriptor;
  empty_hooks_fd =
      binding->empty_hooks_nodes[binding->empty_hooks_directory_index]
          .file_descriptor;
  if (executable->kind != SAFE_GIT_BOUND_REGULAR_FILE ||
      !safe_git_open_task_baseline_marker(
          workspace_fd, request.task_id, request.marker_nonce, &marker) ||
      !safe_git_marker_matches_lease_plan(
          &marker, git_lease_json, request.marker_content_digest) ||
      !safe_git_lease_reflog_is_absent(common_directory_fd, ref_name)) {
    goto cleanup;
  }

  read_request.profile = SAFE_GIT_RUNNER_READ_REV_PARSE_BASELINE_COMMIT_V1;
  memcpy(read_request.parameter_one, request.commit, strlen(request.commit));
  if (!safe_git_run_linux_read_v1(
          executable->file_descriptor, binding->executable.canonical_path,
          workspace_fd, git_directory_fd, common_directory_fd, empty_hooks_fd,
          &read_request, &read_execution) ||
      read_execution.status != SAFE_GIT_RUNNER_STATUS_OK_V1 ||
      read_execution.exit_code != 0) {
    goto cleanup;
  }
  commit_length = strlen(request.commit);
  if (read_execution.stdout_length != commit_length + 1 ||
      memcmp(read_execution.stdout_bytes, request.commit, commit_length) != 0 ||
      read_execution.stdout_bytes[commit_length] != (unsigned char)'\n' ||
      !safe_git_revalidate_task_baseline_marker(
          workspace_fd, request.task_id, request.marker_nonce, &marker) ||
      !safe_git_bind_task_baseline_refs_directory(binding) ||
      binding->task_baseline_refs_directory_index < 0 ||
      (size_t)binding->task_baseline_refs_directory_index >=
          binding->node_count) {
    goto cleanup;
  }
  baseline_directory_fd =
      binding->nodes[binding->task_baseline_refs_directory_index]
          .file_descriptor;
  ref_absent = safe_git_lease_ref_is_absent(baseline_directory_fd, ref_name);
  ref_equal = ref_absent
                  ? 0
                  : safe_git_lease_ref_equals(baseline_directory_fd, ref_name,
                                              request.commit);
  if (!safe_git_lease_reflog_is_absent(common_directory_fd, ref_name) ||
      !safe_git_revalidate_task_baseline_marker(
          workspace_fd, request.task_id, request.marker_nonce, &marker)) {
    goto cleanup;
  }
  if (request.operation == 1) {
    if (!ref_absent) goto cleanup;
  } else if (request.operation == 2) {
    if (ref_equal) {
      execute_mutation = 0;
      resolution = "replayed";
    } else if (!ref_absent) {
      goto cleanup;
    }
  } else if (request.operation == 3) {
    if (ref_absent) {
      execute_mutation = 0;
      resolution = "replayed";
    } else if (ref_equal) {
      resolution = "rolled_back";
    } else {
      goto cleanup;
    }
  } else {
    goto cleanup;
  }
  memcpy(lease_request.ref_name, ref_name, strlen(ref_name));
  memcpy(lease_request.object_id, request.commit, commit_length);
  memcpy(lease_request.zero_object_id, zero_oid, commit_length);
  lease_request.delete_ref = request.operation == 3;
  if (execute_mutation) {
    if (request.operation == 3) {
      runner_ok = safe_git_delete_lease_ref_exact(
          baseline_directory_fd, ref_name, request.commit,
          request.marker_nonce);
    } else {
      runner_ok = safe_git_run_linux_create_lease_v1(
          executable->file_descriptor, binding->executable.canonical_path,
          workspace_fd, git_directory_fd, common_directory_fd, empty_hooks_fd,
          baseline_directory_fd, &lease_request, &lease_execution) &&
          lease_execution.status == SAFE_GIT_RUNNER_STATUS_OK_V1 &&
          lease_execution.exit_code == 0;
    }
  }
  if (execute_mutation && !runner_ok) {
    goto cleanup;
  }
  if ((request.operation == 3
           ? !safe_git_lease_ref_is_absent(baseline_directory_fd, ref_name)
           : !safe_git_lease_ref_equals(baseline_directory_fd, ref_name,
                                        request.commit)) ||
      !safe_git_lease_reflog_is_absent(common_directory_fd, ref_name) ||
      !safe_git_revalidate_task_baseline_marker(
          workspace_fd, request.task_id, request.marker_nonce, &marker) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      !safe_git_create_executable_binding_token(&binding->executable, key,
                                                token) ||
      !safe_git_constant_time_equal(token, binding->executable.binding_token,
                                    sizeof(token)) ||
      !safe_git_create_task_baseline_lease_result(
          env, lease_id, ref_name, request.commit, resolution, &result) ||
      !safe_git_revalidate_task_baseline_marker(
          workspace_fd, request.task_id, request.marker_nonce, &marker) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(&request, sizeof(request));
  safe_git_release_task_baseline_marker_pin(&marker);
  safe_git_release_linux_read_result_v1(&read_execution);
  safe_git_secure_zero(&read_request, sizeof(read_request));
  safe_git_secure_zero(&lease_request, sizeof(lease_request));
  safe_git_secure_zero(&lease_execution, sizeof(lease_execution));
  safe_git_secure_zero(lease_id, sizeof(lease_id));
  safe_git_secure_zero(ref_name, sizeof(ref_name));
  safe_git_secure_zero(zero_oid, sizeof(zero_oid));
  if (git_lease_json != NULL) {
    safe_git_secure_zero(git_lease_json, strlen(git_lease_json));
    free(git_lease_json);
  }
  if (!success) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
#else
  (void)authority;
  memset(&request, 0, sizeof(request));
  if (safe_git_read_task_baseline_lease_create_arguments(
          env, info, &binding, &authority, key, &request) &&
      binding != NULL) {
    safe_git_release_binding(binding);
  }
  safe_git_secure_zero(key, sizeof(key));
  safe_git_secure_zero(token, sizeof(token));
  safe_git_secure_zero(&request, sizeof(request));
  return throw_safe_git_unavailable(env);
#endif
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

static SAFE_GIT_MAYBE_UNUSED int safe_git_derive_repository_worktree_ids(
    struct safe_git_descriptor_binding *binding, const unsigned char key[32],
    char repository_id[75], char worktree_id[79]) {
  unsigned char repository_digest[32] = {0};
  unsigned char worktree_digest[32] = {0};
  char repository_hex[65] = {0};
  char worktree_hex[65] = {0};
  char *canonical_common = NULL;
  char *canonical_root = NULL;
  char *canonical_git = NULL;
  int success = 0;
  if (binding == NULL || key == NULL || repository_id == NULL ||
      worktree_id == NULL ||
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
  if (snprintf(repository_id, 75, "repo-hmac-%s", repository_hex) != 74 ||
      !safe_git_hmac_message(
          key,
          "[\"worktree-identity-v1\",{\"canonicalGitDir\":\"%s\",\"canonicalRoot\":\"%s\",\"repositoryId\":\"%s\"}]",
          canonical_git, canonical_root, repository_id, worktree_digest)) {
    goto cleanup;
  }
  safe_git_digest_hex(worktree_digest, worktree_hex);
  if (snprintf(worktree_id, 79, "worktree-hmac-%s", worktree_hex) != 78) {
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
  safe_git_secure_zero(repository_digest, sizeof(repository_digest));
  safe_git_secure_zero(worktree_digest, sizeof(worktree_digest));
  safe_git_secure_zero(repository_hex, sizeof(repository_hex));
  safe_git_secure_zero(worktree_hex, sizeof(worktree_hex));
  if (!success) {
    safe_git_secure_zero(repository_id, 75);
    safe_git_secure_zero(worktree_id, 79);
  }
  return success;
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
  struct safe_git_descriptor_binding *binding = NULL;
  napi_value result;

  if (!safe_git_unwrap_argument(env, info, &binding) ||
      !safe_git_revalidate_binding(binding) ||
      !safe_git_create_layout_result(env, binding, NULL, &result)) {
    if (binding != NULL) safe_git_release_binding(binding);
    return throw_safe_git_unavailable(env);
  }
  return result;
}

static napi_value arm_test_safe_git_empty_hooks_race(
    napi_env env, napi_callback_info info) {
  struct safe_git_descriptor_binding *binding = NULL;
  napi_value result;
  if (!safe_git_unwrap_argument(env, info, &binding) ||
      !binding->empty_hooks_bound || !binding->empty_hooks_test_authority ||
      binding->test_empty_hooks_race_armed ||
      !safe_git_revalidate_binding(binding) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_safe_git_unavailable(env);
  }
  binding->test_empty_hooks_race_armed = 1;
  return result;
}

static napi_value arm_test_safe_git_executable_owner_admission(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 2;
  napi_value arguments[2];
  bool binding_tagged = false;
  bool authority_tagged = false;
  struct safe_git_descriptor_binding *binding = NULL;
  struct installation_state_authority *authority = NULL;
  napi_value result;
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      napi_check_object_type_tag(env, arguments[0], &SAFE_GIT_BINDING_TYPE_TAG,
                                 &binding_tagged) != napi_ok ||
      !binding_tagged ||
      napi_unwrap(env, arguments[0], (void **)&binding) != napi_ok ||
      binding == NULL ||
      napi_check_object_type_tag(env, arguments[1],
                                 &INSTALLATION_AUTHORITY_TYPE_TAG,
                                 &authority_tagged) != napi_ok ||
      !authority_tagged ||
      napi_unwrap(env, arguments[1], (void **)&authority) != napi_ok ||
      authority == NULL || binding->closed || !binding->empty_hooks_bound ||
      !binding->empty_hooks_test_authority || binding->executable.bound ||
      binding->test_executable_owner_admission_armed ||
      authority->resolver_id == NULL ||
      strcmp(authority->resolver_id, "test-explicit-temporary-root-v1") != 0 ||
      !safe_git_empty_hooks_authority_matches(binding, authority) ||
      !installation_authority_separated_from_safe_git(authority, binding) ||
      !safe_git_revalidate_binding(binding) ||
      !installation_authority_revalidate(authority) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_safe_git_unavailable(env);
  }
  binding->test_executable_owner_admission_armed = 1;
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

static void provider_exact_object_publisher_release(
    struct provider_exact_object_publisher *publisher) {
  size_t index;
  if (publisher == NULL || publisher->closed) return;
  for (index = publisher->node_count; index > 0; index -= 1) {
    if (publisher->nodes[index - 1].file_descriptor >= 0) {
      (void)close(publisher->nodes[index - 1].file_descriptor);
      publisher->nodes[index - 1].file_descriptor = -1;
    }
  }
  publisher->node_count = 0;
  safe_git_secure_zero(publisher->canonical_parent_path,
                       sizeof(publisher->canonical_parent_path));
  safe_git_secure_zero(publisher->test_pre_link_parent_aba_peer_path,
                       sizeof(publisher->test_pre_link_parent_aba_peer_path));
  publisher->closed = 1;
}

static void provider_exact_object_publisher_finalizer(napi_env env, void *data,
                                                       void *hint) {
  struct provider_exact_object_publisher *publisher =
      (struct provider_exact_object_publisher *)data;
  (void)env;
  (void)hint;
  provider_exact_object_publisher_release(publisher);
  free(publisher);
}

static void provider_exact_object_source_release(
    napi_env env, struct provider_exact_object_source *source) {
  if (source == NULL || source->closed) return;
  if (source->file_descriptor >= 0) {
    (void)close(source->file_descriptor);
    source->file_descriptor = -1;
  }
  if (source->mutation_watch_descriptor >= 0) {
    (void)close(source->mutation_watch_descriptor);
    source->mutation_watch_descriptor = -1;
  }
  safe_git_secure_zero(&source->snapshot, sizeof(source->snapshot));
  safe_git_secure_zero(source->parent_watch_ids,
                       sizeof(source->parent_watch_ids));
  safe_git_secure_zero(source->parent_change_times,
                       sizeof(source->parent_change_times));
  source->parent_node_count = 0;
  if (source->publisher != NULL &&
      source->publisher->outstanding_source == source) {
    source->publisher->outstanding_source = NULL;
  }
  if (source->publisher_reference != NULL) {
    (void)napi_delete_reference(env, source->publisher_reference);
    source->publisher_reference = NULL;
  }
  source->publisher = NULL;
  source->closed = 1;
}

#if defined(__linux__)
static void provider_exact_object_source_finalizer(napi_env env, void *data,
                                                    void *hint) {
  struct provider_exact_object_source *source =
      (struct provider_exact_object_source *)data;
  (void)env;
  (void)hint;
  provider_exact_object_source_release(env, source);
  free(source);
}

static int provider_exact_object_directory_identity_matches(
    const struct stat *expected, const struct stat *observed) {
  return S_ISDIR(observed->st_mode) &&
         expected->st_dev == observed->st_dev &&
         expected->st_ino == observed->st_ino &&
         expected->st_uid == observed->st_uid &&
         expected->st_gid == observed->st_gid &&
         expected->st_mode == observed->st_mode;
}

static int provider_exact_object_change_time_matches(
    const struct timespec *expected, const struct stat *observed) {
  return expected->tv_sec == observed->st_ctim.tv_sec &&
         expected->tv_nsec == observed->st_ctim.tv_nsec;
}

#define PROVIDER_EXACT_OBJECT_PARENT_WATCH_MASK                              \
  (IN_ATTRIB | IN_CLOSE_WRITE | IN_CREATE | IN_DELETE | IN_DELETE_SELF |    \
   IN_MODIFY | IN_MOVE_SELF | IN_MOVED_FROM | IN_MOVED_TO | IN_UNMOUNT)

static int provider_exact_object_parent_watch_has_no_events(
    struct provider_exact_object_source *source) {
  char buffer[4096]
      __attribute__((aligned(__alignof__(struct inotify_event))));
  if (source == NULL || source->mutation_watch_descriptor < 0) return 0;
  for (;;) {
    ssize_t length =
        read(source->mutation_watch_descriptor, buffer, sizeof(buffer));
    if (length < 0 && errno == EINTR) continue;
    if (length < 0 && errno == EAGAIN) {
      safe_git_secure_zero(buffer, sizeof(buffer));
      return 1;
    }
    safe_git_secure_zero(buffer, sizeof(buffer));
    return 0;
  }
}

static int provider_exact_object_initialize_parent_watches(
    struct provider_exact_object_source *source) {
  struct provider_exact_object_publisher *publisher;
  char descriptor_path[64];
  size_t index;
  size_t prior;
  int written;
  int watch_descriptor;
  if (source == NULL || source->closed || source->publisher == NULL ||
      source->mutation_watch_descriptor >= 0) {
    return 0;
  }
  publisher = source->publisher;
  if (publisher->closed || publisher->node_count < 2 ||
      publisher->node_count > PROVIDER_EXACT_OBJECT_NODE_LIMIT) {
    return 0;
  }
  source->mutation_watch_descriptor = inotify_init1(IN_NONBLOCK | IN_CLOEXEC);
  if (source->mutation_watch_descriptor < 0) return 0;
  source->parent_node_count = publisher->node_count;
  for (index = 0; index < publisher->node_count; index += 1) {
    written = snprintf(descriptor_path, sizeof(descriptor_path),
                       "/proc/self/fd/%d",
                       publisher->nodes[index].file_descriptor);
    if (written < 1 || written >= (int)sizeof(descriptor_path)) return 0;
    watch_descriptor = inotify_add_watch(
        source->mutation_watch_descriptor, descriptor_path,
        PROVIDER_EXACT_OBJECT_PARENT_WATCH_MASK | IN_ONLYDIR);
    safe_git_secure_zero(descriptor_path, sizeof(descriptor_path));
    if (watch_descriptor < 0) return 0;
    for (prior = 0; prior < index; prior += 1) {
      if (source->parent_watch_ids[prior] == watch_descriptor) return 0;
    }
    source->parent_watch_ids[index] = watch_descriptor;
  }
  return provider_exact_object_parent_watch_has_no_events(source);
}

/*
 * ctime cannot attribute the final parent's expected link mutation. A
 * retained watch on every chain directory covers clock-tick coalescing and
 * pathname ABA from staging through publication. Exactly one final-parent
 * CREATE for our fixed name is admissible; every other queued mutation fails.
 */
static int provider_exact_object_consume_expected_link_event(
    struct provider_exact_object_source *source, const char *final_name) {
  char buffer[4096]
      __attribute__((aligned(__alignof__(struct inotify_event))));
  int expected_create_count = 0;
  int final_watch;
  size_t final_name_length;
  if (source == NULL || source->mutation_watch_descriptor < 0 ||
      source->parent_node_count < 2 || final_name == NULL) {
    return 0;
  }
  final_name_length = strlen(final_name);
  if (final_name_length < 1 || final_name_length > NAME_MAX) return 0;
  final_watch = source->parent_watch_ids[source->parent_node_count - 1];
  for (;;) {
    ssize_t length =
        read(source->mutation_watch_descriptor, buffer, sizeof(buffer));
    size_t offset = 0;
    if (length < 0 && errno == EINTR) continue;
    if (length < 0 && errno == EAGAIN) break;
    if (length <= 0) return 0;
    while (offset < (size_t)length) {
      const struct inotify_event *event =
          (const struct inotify_event *)(buffer + offset);
      size_t event_size;
      if ((size_t)length - offset < sizeof(struct inotify_event)) {
        safe_git_secure_zero(buffer, sizeof(buffer));
        return 0;
      }
      event_size = sizeof(struct inotify_event) + event->len;
      if (event_size > (size_t)length - offset ||
          event->len < final_name_length + 1) {
        safe_git_secure_zero(buffer, sizeof(buffer));
        return 0;
      }
      if (event->wd == final_watch && event->mask == IN_CREATE &&
          memcmp(event->name, final_name, final_name_length) == 0 &&
          event->name[final_name_length] == '\0') {
        expected_create_count += 1;
      } else {
        safe_git_secure_zero(buffer, sizeof(buffer));
        return 0;
      }
      if (expected_create_count > 1) {
        safe_git_secure_zero(buffer, sizeof(buffer));
        return 0;
      }
      offset += event_size;
    }
  }
  safe_git_secure_zero(buffer, sizeof(buffer));
  return expected_create_count == 1;
}

static int provider_exact_object_revalidate_parent_chain(
    struct provider_exact_object_publisher *publisher);

/*
 * Bind one staged source to the nanosecond ctime of every retained
 * root-to-parent descriptor. Linux does not expose an API that can set ctime;
 * rename/reparent/exchange can only advance it. The open descriptors also keep
 * an unlinked directory inode allocated, so unlink/recreate cannot recycle its
 * inode into this capability while the source is live.
 */
static int provider_exact_object_bind_source_parent_chain(
    struct provider_exact_object_source *source) {
  struct provider_exact_object_publisher *publisher;
  struct stat observed;
  size_t index;
  if (source == NULL || source->closed || source->publisher == NULL) return 0;
  publisher = source->publisher;
  if (publisher->closed || publisher->node_count < 2 ||
      publisher->node_count > PROVIDER_EXACT_OBJECT_NODE_LIMIT ||
      source->mutation_watch_descriptor < 0 ||
      source->parent_node_count != publisher->node_count ||
      !provider_exact_object_revalidate_parent_chain(publisher)) {
    return 0;
  }
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (source->parent_watch_ids[index] < 0 ||
        fstat(publisher->nodes[index].file_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed)) {
      return 0;
    }
    source->parent_change_times[index] = observed.st_ctim;
  }
  if (!provider_exact_object_revalidate_parent_chain(publisher)) return 0;
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (fstat(publisher->nodes[index].file_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed) ||
        !provider_exact_object_change_time_matches(
            &source->parent_change_times[index], &observed)) {
      return 0;
    }
  }
  return provider_exact_object_parent_watch_has_no_events(source);
}

static int provider_exact_object_source_parent_chain_matches(
    struct provider_exact_object_source *source) {
  struct provider_exact_object_publisher *publisher;
  struct stat observed;
  size_t index;
  if (source == NULL || source->closed || source->publisher == NULL) return 0;
  publisher = source->publisher;
  if (publisher->closed || source->parent_node_count != publisher->node_count ||
      !provider_exact_object_revalidate_parent_chain(publisher)) {
    return 0;
  }
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (source->parent_watch_ids[index] < 0 ||
        fstat(publisher->nodes[index].file_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed) ||
        !provider_exact_object_change_time_matches(
            &source->parent_change_times[index], &observed)) {
      return 0;
    }
  }
  return provider_exact_object_parent_watch_has_no_events(source);
}

static int provider_exact_object_capture_post_link_parent_chain(
    struct provider_exact_object_source *source,
    struct timespec observed_change_times[PROVIDER_EXACT_OBJECT_NODE_LIMIT]) {
  struct provider_exact_object_publisher *publisher;
  struct stat observed;
  size_t index;
  if (source == NULL || source->closed || source->publisher == NULL) return 0;
  publisher = source->publisher;
  if (publisher->closed || source->parent_node_count != publisher->node_count ||
      !provider_exact_object_revalidate_parent_chain(publisher)) {
    return 0;
  }
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (fstat(publisher->nodes[index].file_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed) ||
        (index + 1 < publisher->node_count &&
         !provider_exact_object_change_time_matches(
             &source->parent_change_times[index], &observed))) {
      return 0;
    }
    observed_change_times[index] = observed.st_ctim;
  }
  return 1;
}

static int provider_exact_object_post_link_parent_chain_matches(
    struct provider_exact_object_source *source,
    const struct timespec
        observed_change_times[PROVIDER_EXACT_OBJECT_NODE_LIMIT]) {
  struct provider_exact_object_publisher *publisher;
  struct stat observed;
  size_t index;
  if (source == NULL || source->closed || source->publisher == NULL) return 0;
  publisher = source->publisher;
  if (publisher->closed || source->parent_node_count != publisher->node_count ||
      !provider_exact_object_revalidate_parent_chain(publisher)) {
    return 0;
  }
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&observed, 0, sizeof(observed));
    if (fstat(publisher->nodes[index].file_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed) ||
        !provider_exact_object_change_time_matches(
            &observed_change_times[index], &observed)) {
      return 0;
    }
  }
  return 1;
}

static int provider_exact_object_managed_parent_admitted(
    struct provider_exact_object_publisher *publisher, int file_descriptor,
    const struct stat *expected) {
#if defined(__linux__)
  struct stat observed;
  struct statfs filesystem;
  memset(&observed, 0, sizeof(observed));
  memset(&filesystem, 0, sizeof(filesystem));
  return publisher != NULL && !publisher->closed &&
         S_ISDIR(expected->st_mode) &&
         expected->st_uid == publisher->expected_owner_uid &&
         expected->st_gid == publisher->expected_owner_gid &&
         (((unsigned int)expected->st_mode) & 07777U) == 0700U &&
         fstatfs(file_descriptor, &filesystem) == 0 &&
         filesystem.f_type == (long)EXT4_SUPER_MAGIC &&
         fd_has_no_extended_access_control(file_descriptor,
                                           EXPECTED_FILE_KIND_DIRECTORY) &&
         fstat(file_descriptor, &observed) == 0 &&
         provider_exact_object_directory_identity_matches(expected,
                                                          &observed);
#else
  (void)publisher;
  (void)file_descriptor;
  (void)expected;
  return 0;
#endif
}
#endif

static int provider_exact_object_read_parent_path(
    napi_env env, napi_value argument, char output[PATH_MAX + 1]) {
  napi_valuetype argument_type;
  size_t length = 0;
  size_t copied = 0;
  size_t index;
  if (napi_typeof(env, argument, &argument_type) != napi_ok ||
      argument_type != napi_string ||
      napi_get_value_string_utf8(env, argument, NULL, 0, &length) != napi_ok ||
      length < 2 || length > PATH_MAX ||
      napi_get_value_string_utf8(env, argument, output, length + 1, &copied) !=
          napi_ok ||
      copied != length || output[0] != '/' || output[length - 1] == '/') {
    return 0;
  }
  for (index = 1; index < length; index += 1) {
    if (output[index] == '/' &&
        (index == 1 || output[index - 1] == '/')) {
      return 0;
    }
  }
  return 1;
}

static int provider_exact_object_read_owner_id(napi_env env, napi_value value,
                                               uint32_t *result) {
  napi_valuetype value_type;
  double numeric;
  if (napi_typeof(env, value, &value_type) != napi_ok ||
      value_type != napi_number ||
      napi_get_value_double(env, value, &numeric) != napi_ok ||
      !isfinite(numeric) || numeric < 0 || numeric > UINT32_MAX ||
      trunc(numeric) != numeric) {
    return 0;
  }
  *result = (uint32_t)numeric;
  return numeric == (double)*result;
}

#if defined(__linux__)
static int provider_exact_object_add_directory_node(
    struct provider_exact_object_publisher *publisher, int file_descriptor,
    const char *component) {
  struct provider_exact_object_node *node;
  struct stat metadata;
  size_t component_length = component == NULL ? 0 : strlen(component);
  memset(&metadata, 0, sizeof(metadata));
  if (publisher == NULL || publisher->closed ||
      publisher->node_count >= PROVIDER_EXACT_OBJECT_NODE_LIMIT ||
      component_length > NAME_MAX ||
      (component_length > 0 && !safe_git_component_is_valid(component)) ||
      fstat(file_descriptor, &metadata) != 0 ||
      !S_ISDIR(metadata.st_mode)) {
    return 0;
  }
  node = &publisher->nodes[publisher->node_count];
  memset(node, 0, sizeof(*node));
  node->file_descriptor = file_descriptor;
  node->snapshot = metadata;
  if (component_length > 0) {
    memcpy(node->component, component, component_length);
  }
  node->component[component_length] = '\0';
  publisher->node_count += 1;
  return 1;
}
#endif

static int provider_exact_object_open_parent_chain(
    struct provider_exact_object_publisher *publisher, const char *path) {
#if defined(__linux__)
  char component[NAME_MAX + 1];
  size_t component_length = 0;
  size_t index;
  int root_descriptor;
  int child_descriptor;
  int parent_descriptor;
  if (publisher == NULL || path == NULL) return 0;
  root_descriptor = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (root_descriptor < 0 ||
      !provider_exact_object_add_directory_node(publisher, root_descriptor,
                                                "")) {
    if (root_descriptor >= 0) (void)close(root_descriptor);
    return 0;
  }
  parent_descriptor = root_descriptor;
  for (index = 1;; index += 1) {
    unsigned char byte = (unsigned char)path[index];
    if (byte != '/' && byte != '\0') {
      if (component_length >= NAME_MAX) return 0;
      component[component_length++] = (char)byte;
      continue;
    }
    component[component_length] = '\0';
    if (!safe_git_component_is_valid(component)) return 0;
    child_descriptor = openat(parent_descriptor, component,
                              O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (child_descriptor < 0 ||
        !provider_exact_object_add_directory_node(
            publisher, child_descriptor, component)) {
      if (child_descriptor >= 0) (void)close(child_descriptor);
      return 0;
    }
    parent_descriptor = child_descriptor;
    component_length = 0;
    if (byte == '\0') break;
  }
  return publisher->node_count >= 2 &&
         provider_exact_object_managed_parent_admitted(
             publisher,
             publisher->nodes[publisher->node_count - 1].file_descriptor,
             &publisher->nodes[publisher->node_count - 1].snapshot);
#else
  (void)publisher;
  (void)path;
  return 0;
#endif
}

/*
 * Reopen the complete root-to-parent projection and compare every component
 * with its retained descriptor.  This is a rejection-only observation: it
 * never selects a replacement parent and the final link always uses the held
 * parent descriptor.
 */
static int provider_exact_object_revalidate_parent_chain(
    struct provider_exact_object_publisher *publisher) {
#if defined(__linux__)
  struct stat retained;
  struct stat observed;
  size_t index;
  int current_descriptor = -1;
  int next_descriptor = -1;
  int result = 0;
  if (publisher == NULL || publisher->closed || publisher->node_count < 2) {
    return 0;
  }
  for (index = 0; index < publisher->node_count; index += 1) {
    memset(&retained, 0, sizeof(retained));
    if (fstat(publisher->nodes[index].file_descriptor, &retained) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &retained)) {
      return 0;
    }
  }
  current_descriptor =
      open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (current_descriptor < 0 || fstat(current_descriptor, &observed) != 0 ||
      !provider_exact_object_directory_identity_matches(
          &publisher->nodes[0].snapshot, &observed)) {
    goto cleanup;
  }
  for (index = 1; index < publisher->node_count; index += 1) {
    next_descriptor = openat(current_descriptor,
                             publisher->nodes[index].component,
                             O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next_descriptor < 0 || fstat(next_descriptor, &observed) != 0 ||
        !provider_exact_object_directory_identity_matches(
            &publisher->nodes[index].snapshot, &observed)) {
      goto cleanup;
    }
    (void)close(current_descriptor);
    current_descriptor = next_descriptor;
    next_descriptor = -1;
  }
  result = provider_exact_object_managed_parent_admitted(
      publisher,
      publisher->nodes[publisher->node_count - 1].file_descriptor,
      &publisher->nodes[publisher->node_count - 1].snapshot);

cleanup:
  if (next_descriptor >= 0) (void)close(next_descriptor);
  if (current_descriptor >= 0) (void)close(current_descriptor);
  return result;
#else
  (void)publisher;
  return 0;
#endif
}

static int provider_exact_object_unwrap_publisher(
    napi_env env, napi_value value,
    struct provider_exact_object_publisher **publisher) {
  bool tagged = false;
  return napi_check_object_type_tag(env, value,
                                    &PROVIDER_EXACT_OBJECT_PUBLISHER_TYPE_TAG,
                                    &tagged) == napi_ok &&
         tagged && napi_unwrap(env, value, (void **)publisher) == napi_ok &&
         *publisher != NULL;
}

static int provider_exact_object_unwrap_source(
    napi_env env, napi_value value,
    struct provider_exact_object_source **source) {
  bool tagged = false;
  return napi_check_object_type_tag(env, value,
                                    &PROVIDER_EXACT_OBJECT_SOURCE_TYPE_TAG,
                                    &tagged) == napi_ok &&
         tagged && napi_unwrap(env, value, (void **)source) == napi_ok &&
         *source != NULL;
}

static napi_value open_provider_exact_object_publisher(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 3;
  napi_value arguments[3];
  napi_value object;
  struct provider_exact_object_publisher *publisher = NULL;
  char path[PATH_MAX + 1];
  uint32_t expected_owner_uid;
  uint32_t expected_owner_gid;
  memset(path, 0, sizeof(path));
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 3 ||
      !provider_exact_object_read_parent_path(env, arguments[0], path) ||
      !provider_exact_object_read_owner_id(env, arguments[1],
                                           &expected_owner_uid) ||
      !provider_exact_object_read_owner_id(env, arguments[2],
                                           &expected_owner_gid) ||
      (geteuid() != 0 &&
       (geteuid() != (uid_t)expected_owner_uid ||
        getegid() != (gid_t)expected_owner_gid))) {
    return throw_provider_exact_object_unavailable(env);
  }
  publisher = (struct provider_exact_object_publisher *)calloc(
      1, sizeof(*publisher));
  if (publisher == NULL) {
    safe_git_secure_zero(path, sizeof(path));
    return throw_provider_exact_object_unavailable(env);
  }
  publisher->expected_owner_uid = (uid_t)expected_owner_uid;
  publisher->expected_owner_gid = (gid_t)expected_owner_gid;
  for (argument_count = 0;
       argument_count < PROVIDER_EXACT_OBJECT_NODE_LIMIT; argument_count += 1) {
    publisher->nodes[argument_count].file_descriptor = -1;
  }
  memcpy(publisher->canonical_parent_path, path, strlen(path) + 1);
  if (!provider_exact_object_open_parent_chain(publisher, path) ||
      !provider_exact_object_revalidate_parent_chain(publisher) ||
      napi_create_object(env, &object) != napi_ok ||
      napi_wrap(env, object, publisher,
                provider_exact_object_publisher_finalizer, NULL, NULL) !=
          napi_ok) {
    provider_exact_object_publisher_release(publisher);
    free(publisher);
    safe_git_secure_zero(path, sizeof(path));
    return throw_provider_exact_object_unavailable(env);
  }
  if (napi_type_tag_object(env, object,
                           &PROVIDER_EXACT_OBJECT_PUBLISHER_TYPE_TAG) !=
      napi_ok) {
    provider_exact_object_publisher_release(publisher);
    safe_git_secure_zero(path, sizeof(path));
    return throw_provider_exact_object_unavailable(env);
  }
  safe_git_secure_zero(path, sizeof(path));
  return object;
}

#if defined(__linux__)
static int provider_exact_object_source_admitted(
    struct provider_exact_object_source *source) {
#if defined(__linux__)
  struct stat observed;
  struct stat parent;
  memset(&observed, 0, sizeof(observed));
  memset(&parent, 0, sizeof(parent));
  return source != NULL && !source->closed && source->file_descriptor >= 0 &&
         source->publisher != NULL && !source->publisher->closed &&
         fstat(source->file_descriptor, &observed) == 0 &&
         stat_snapshot_matches(&source->snapshot, &observed) &&
         S_ISREG(observed.st_mode) &&
         observed.st_uid == source->publisher->expected_owner_uid &&
         observed.st_gid == source->publisher->expected_owner_gid &&
         (((unsigned int)observed.st_mode) & 07777U) == 0600U &&
         observed.st_nlink == 0 &&
         fd_has_no_extended_access_control(source->file_descriptor,
                                           EXPECTED_FILE_KIND_REGULAR_FILE) &&
         fstat(source->publisher
                   ->nodes[source->publisher->node_count - 1]
                   .file_descriptor,
               &parent) == 0 &&
         parent.st_dev == observed.st_dev;
#else
  (void)source;
  return 0;
#endif
}
#endif

static napi_value stage_provider_exact_object(napi_env env,
                                              napi_callback_info info) {
  size_t argument_count = 2;
  napi_value arguments[2];
  napi_value object;
  struct provider_exact_object_publisher *publisher = NULL;
  struct provider_exact_object_source *source = NULL;
  void *bytes = NULL;
  size_t length = 0;
  size_t offset = 0;
  int file_descriptor = -1;
#if defined(__linux__)
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      !provider_exact_object_unwrap_publisher(env, arguments[0], &publisher) ||
      publisher->closed || publisher->outstanding_source != NULL ||
      geteuid() != publisher->expected_owner_uid ||
      getegid() != publisher->expected_owner_gid ||
      napi_get_buffer_info(env, arguments[1], &bytes, &length) != napi_ok ||
      length > PROVIDER_EXACT_OBJECT_BYTES_LIMIT ||
      !provider_exact_object_revalidate_parent_chain(publisher)) {
    return throw_provider_exact_object_unavailable(env);
  }
  file_descriptor = openat(
      publisher->nodes[publisher->node_count - 1].file_descriptor, ".",
      O_TMPFILE | O_RDWR | O_CLOEXEC | O_NOCTTY, 0600);
  if (file_descriptor < 0 || fchmod(file_descriptor, 0600) != 0) {
    if (file_descriptor >= 0) (void)close(file_descriptor);
    return throw_provider_exact_object_unavailable(env);
  }
  while (offset < length) {
    ssize_t written = write(file_descriptor,
                            ((const unsigned char *)bytes) + offset,
                            length - offset);
    if (written < 0 && errno == EINTR) continue;
    if (written <= 0) {
      (void)close(file_descriptor);
      return throw_provider_exact_object_unavailable(env);
    }
    offset += (size_t)written;
  }
  if (fsync(file_descriptor) != 0) {
    (void)close(file_descriptor);
    return throw_provider_exact_object_unavailable(env);
  }
  source = (struct provider_exact_object_source *)calloc(1, sizeof(*source));
  if (source == NULL) {
    (void)close(file_descriptor);
    return throw_provider_exact_object_unavailable(env);
  }
  source->file_descriptor = -1;
  source->mutation_watch_descriptor = -1;
  for (offset = 0; offset < PROVIDER_EXACT_OBJECT_NODE_LIMIT; offset += 1) {
    source->parent_watch_ids[offset] = -1;
  }
  source->file_descriptor = file_descriptor;
  source->publisher = publisher;
  if (napi_create_reference(env, arguments[0], 1,
                            &source->publisher_reference) != napi_ok) {
    provider_exact_object_source_release(env, source);
    free(source);
    return throw_provider_exact_object_unavailable(env);
  }
  publisher->outstanding_source = source;
  if (fstat(file_descriptor, &source->snapshot) != 0 ||
      source->snapshot.st_size != (off_t)length ||
      !provider_exact_object_source_admitted(source) ||
      !provider_exact_object_initialize_parent_watches(source) ||
      !provider_exact_object_bind_source_parent_chain(source) ||
      napi_create_object(env, &object) != napi_ok ||
      napi_wrap(env, object, source, provider_exact_object_source_finalizer,
                NULL, NULL) != napi_ok) {
    provider_exact_object_source_release(env, source);
    free(source);
    return throw_provider_exact_object_unavailable(env);
  }
  if (napi_type_tag_object(env, object,
                           &PROVIDER_EXACT_OBJECT_SOURCE_TYPE_TAG) != napi_ok) {
    provider_exact_object_source_release(env, source);
    return throw_provider_exact_object_unavailable(env);
  }
  return object;
#else
  (void)argument_count;
  (void)info;
  (void)arguments;
  (void)object;
  (void)publisher;
  (void)source;
  (void)bytes;
  (void)length;
  (void)offset;
  (void)file_descriptor;
  return throw_provider_exact_object_unavailable(env);
#endif
}

#if defined(__linux__)
static int provider_exact_object_read_final_name(
    napi_env env, napi_value argument, char output[NAME_MAX + 1]) {
  napi_valuetype argument_type;
  size_t length = 0;
  size_t copied = 0;
  size_t index;
  if (napi_typeof(env, argument, &argument_type) != napi_ok ||
      argument_type != napi_string ||
      napi_get_value_string_utf8(env, argument, NULL, 0, &length) != napi_ok ||
      length != 69 ||
      napi_get_value_string_utf8(env, argument, output, length + 1, &copied) !=
          napi_ok ||
      copied != length || strcmp(output + 64, ".blob") != 0) {
    return 0;
  }
  for (index = 0; index < 64; index += 1) {
    if (!((output[index] >= '0' && output[index] <= '9') ||
          (output[index] >= 'a' && output[index] <= 'f'))) {
      return 0;
    }
  }
  return 1;
}

static napi_value provider_exact_object_commit_result(napi_env env,
                                                       int committed,
                                                       const char *reason) {
  napi_value result;
  napi_value status;
  napi_value reason_value;
  const char *status_text = committed > 0
                                ? "committed"
                                : committed < 0
                                      ? "durability_indeterminate"
                                      : "not_committed";
  if (napi_create_object(env, &result) != napi_ok ||
      napi_create_string_utf8(env, status_text, NAPI_AUTO_LENGTH, &status) !=
          napi_ok ||
      napi_set_named_property(env, result, "status", status) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
  }
  if (committed == 0 &&
      (reason == NULL ||
       napi_create_string_utf8(env, reason, NAPI_AUTO_LENGTH, &reason_value) !=
           napi_ok ||
       napi_set_named_property(env, result, "reason", reason_value) !=
           napi_ok)) {
    return throw_provider_exact_object_unavailable(env);
  }
  return result;
}

static int provider_exact_object_fsync_parent(
    struct provider_exact_object_publisher *publisher,
    int parent_descriptor) {
  if (publisher->test_parent_fsync_failure_armed) {
    publisher->test_parent_fsync_failure_armed = 0;
    errno = EIO;
    return 0;
  }
  return fsync(parent_descriptor) == 0;
}

static int provider_exact_object_linked_source_identity_matches(
    const struct provider_exact_object_source *source,
    const struct stat *observed, nlink_t expected_link_count) {
  return source != NULL && observed != NULL &&
         S_ISREG(observed->st_mode) &&
         observed->st_dev == source->snapshot.st_dev &&
         observed->st_ino == source->snapshot.st_ino &&
         observed->st_mode == source->snapshot.st_mode &&
         observed->st_uid == source->snapshot.st_uid &&
         observed->st_gid == source->snapshot.st_gid &&
         observed->st_size == source->snapshot.st_size &&
         observed->st_nlink == expected_link_count;
}

static int provider_exact_object_rollback_linked_source(
    struct provider_exact_object_source *source, int parent_descriptor,
    const char *final_name) {
  struct stat held;
  struct stat projected;
  struct stat after;
  memset(&held, 0, sizeof(held));
  memset(&projected, 0, sizeof(projected));
  memset(&after, 0, sizeof(after));
  if (source == NULL || final_name == NULL ||
      fstat(source->file_descriptor, &held) != 0 ||
      fstatat(parent_descriptor, final_name, &projected,
              AT_SYMLINK_NOFOLLOW) != 0 ||
      !provider_exact_object_linked_source_identity_matches(source, &held, 1) ||
      !provider_exact_object_linked_source_identity_matches(
          source, &projected, 1) ||
      held.st_dev != projected.st_dev || held.st_ino != projected.st_ino ||
      unlinkat(parent_descriptor, final_name, 0) != 0 ||
      fstat(source->file_descriptor, &after) != 0 ||
      !provider_exact_object_linked_source_identity_matches(source, &after, 0)) {
    return 0;
  }
  return fsync(parent_descriptor) == 0;
}

static int provider_exact_object_apply_test_post_link_parent_change(
    struct provider_exact_object_publisher *publisher,
    int parent_descriptor, const struct timespec *captured_change_time) {
  mode_t original_mode;
  mode_t changed_mode;
  struct stat observed;
  struct timespec delay;
  size_t attempt;
  if (!publisher->test_post_link_parent_change_armed) return 1;
  publisher->test_post_link_parent_change_armed = 0;
  original_mode = publisher->nodes[publisher->node_count - 1].snapshot.st_mode &
                  (mode_t)07777;
  changed_mode = original_mode ^ (mode_t)0001;
  for (attempt = 0; attempt < 1000; attempt += 1) {
    delay.tv_sec = 0;
    delay.tv_nsec = 1000000;
    while (nanosleep(&delay, NULL) != 0 && errno == EINTR) {
    }
    memset(&observed, 0, sizeof(observed));
    if (fchmod(parent_descriptor, changed_mode) != 0 ||
        fchmod(parent_descriptor, original_mode) != 0 ||
        fstat(parent_descriptor, &observed) != 0) {
      return 0;
    }
    if (!provider_exact_object_change_time_matches(captured_change_time,
                                                   &observed)) {
      return 1;
    }
  }
  return 0;
}

static int provider_exact_object_test_exchange_parent_paths(
    const char *left, const char *right) {
#if defined(SYS_renameat2) && defined(RENAME_EXCHANGE)
  int result;
  do {
    result = (int)syscall(SYS_renameat2, AT_FDCWD, left, AT_FDCWD, right,
                          RENAME_EXCHANGE);
  } while (result != 0 && errno == EINTR);
  return result == 0;
#else
  (void)left;
  (void)right;
  return 0;
#endif
}

static int provider_exact_object_apply_test_pre_link_parent_aba(
    struct provider_exact_object_publisher *publisher) {
  int first_exchange;
  int second_exchange;
  if (!publisher->test_pre_link_parent_aba_armed) return 1;
  publisher->test_pre_link_parent_aba_armed = 0;
  first_exchange = provider_exact_object_test_exchange_parent_paths(
      publisher->canonical_parent_path,
      publisher->test_pre_link_parent_aba_peer_path);
  second_exchange = first_exchange &&
                    provider_exact_object_test_exchange_parent_paths(
                        publisher->canonical_parent_path,
                        publisher->test_pre_link_parent_aba_peer_path);
  if (first_exchange && !second_exchange) {
    (void)provider_exact_object_test_exchange_parent_paths(
        publisher->canonical_parent_path,
        publisher->test_pre_link_parent_aba_peer_path);
  }
  safe_git_secure_zero(publisher->test_pre_link_parent_aba_peer_path,
                       sizeof(publisher->test_pre_link_parent_aba_peer_path));
  return first_exchange && second_exchange;
}
#endif

static napi_value commit_provider_exact_object(napi_env env,
                                               napi_callback_info info) {
  size_t argument_count = 3;
  napi_value arguments[3];
  struct provider_exact_object_publisher *publisher = NULL;
  struct provider_exact_object_source *source = NULL;
  char final_name[NAME_MAX + 1];
  int source_admitted;
  int parent_admitted;
  int link_result;
  int link_error;
  int parent_descriptor;
  int post_link_parent_admitted;
  struct timespec
      post_link_change_times[PROVIDER_EXACT_OBJECT_NODE_LIMIT];
  memset(final_name, 0, sizeof(final_name));
  memset(post_link_change_times, 0, sizeof(post_link_change_times));
#if defined(__linux__)
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 3 ||
      !provider_exact_object_unwrap_publisher(env, arguments[0], &publisher) ||
      !provider_exact_object_unwrap_source(env, arguments[1], &source) ||
      !provider_exact_object_read_final_name(env, arguments[2], final_name) ||
      publisher->closed || source->closed || source->publisher != publisher) {
    safe_git_secure_zero(final_name, sizeof(final_name));
    return throw_provider_exact_object_unavailable(env);
  }
  /* A source is a single-attempt capability, including rejected attempts. */
  source_admitted = provider_exact_object_source_admitted(source);
  parent_admitted =
      provider_exact_object_source_parent_chain_matches(source);
  if (!source_admitted) {
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return provider_exact_object_commit_result(
        env, 0, "staging_authority_changed");
  }
  if (!parent_admitted) {
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return provider_exact_object_commit_result(
        env, 0, "parent_path_projection_changed");
  }
  if (!provider_exact_object_apply_test_pre_link_parent_aba(publisher)) {
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return provider_exact_object_commit_result(
        env, 0, "parent_path_projection_changed");
  }
  parent_descriptor =
      publisher->nodes[publisher->node_count - 1].file_descriptor;
  errno = 0;
  link_result = linkat(source->file_descriptor, "", parent_descriptor,
                       final_name, AT_EMPTY_PATH);
  link_error = errno;
  if (link_result != 0) {
    int parent_unchanged =
        provider_exact_object_parent_watch_has_no_events(source);
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    if (!parent_unchanged) {
      return provider_exact_object_commit_result(
          env, 0, "parent_path_projection_changed");
    }
    if (link_error == EEXIST) {
      /*
       * EEXIST is also the recovery observation for a prior link whose parent
       * fsync was indeterminate.  Do not report the collision as stable until
       * the held parent descriptor has been durably synchronized.
       */
      if (!provider_exact_object_fsync_parent(publisher,
                                              parent_descriptor)) {
        return provider_exact_object_commit_result(env, -1, NULL);
      }
      return provider_exact_object_commit_result(env, 0, "final_collision");
    }
    return provider_exact_object_commit_result(env, 0,
                                                "profile_unsupported");
  }
  post_link_parent_admitted =
      provider_exact_object_consume_expected_link_event(source, final_name) &&
      provider_exact_object_capture_post_link_parent_chain(
          source, post_link_change_times) &&
      provider_exact_object_apply_test_post_link_parent_change(
          publisher, parent_descriptor,
          &post_link_change_times[publisher->node_count - 1]) &&
      provider_exact_object_post_link_parent_chain_matches(
          source, post_link_change_times) &&
      provider_exact_object_parent_watch_has_no_events(source);
  if (!post_link_parent_admitted) {
    int rolled_back = provider_exact_object_rollback_linked_source(
        source, parent_descriptor, final_name);
    safe_git_secure_zero(post_link_change_times,
                         sizeof(post_link_change_times));
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return rolled_back
               ? provider_exact_object_commit_result(
                     env, 0, "parent_path_projection_changed")
               : provider_exact_object_commit_result(env, -1, NULL);
  }
  if (!provider_exact_object_fsync_parent(publisher, parent_descriptor)) {
    safe_git_secure_zero(post_link_change_times,
                         sizeof(post_link_change_times));
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return provider_exact_object_commit_result(env, -1, NULL);
  }
  if (!provider_exact_object_post_link_parent_chain_matches(
          source, post_link_change_times) ||
      !provider_exact_object_parent_watch_has_no_events(source)) {
    int rolled_back = provider_exact_object_rollback_linked_source(
        source, parent_descriptor, final_name);
    safe_git_secure_zero(post_link_change_times,
                         sizeof(post_link_change_times));
    provider_exact_object_source_release(env, source);
    safe_git_secure_zero(final_name, sizeof(final_name));
    return rolled_back
               ? provider_exact_object_commit_result(
                     env, 0, "parent_path_projection_changed")
               : provider_exact_object_commit_result(env, -1, NULL);
  }
  safe_git_secure_zero(post_link_change_times,
                       sizeof(post_link_change_times));
  provider_exact_object_source_release(env, source);
  safe_git_secure_zero(final_name, sizeof(final_name));
  return provider_exact_object_commit_result(env, 1, NULL);
#else
  (void)argument_count;
  (void)info;
  (void)arguments;
  (void)publisher;
  (void)source;
  (void)source_admitted;
  (void)parent_admitted;
  (void)link_result;
  (void)link_error;
  (void)parent_descriptor;
  (void)post_link_parent_admitted;
  safe_git_secure_zero(post_link_change_times,
                       sizeof(post_link_change_times));
  safe_git_secure_zero(final_name, sizeof(final_name));
  return throw_provider_exact_object_unavailable(env);
#endif
}

static napi_value arm_test_provider_exact_object_parent_fsync_failure(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  napi_value result;
  struct provider_exact_object_publisher *publisher = NULL;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !provider_exact_object_unwrap_publisher(env, argument, &publisher) ||
      publisher->closed || publisher->test_parent_fsync_failure_armed ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
  }
  publisher->test_parent_fsync_failure_armed = 1;
  return result;
}

static napi_value arm_test_provider_exact_object_post_link_parent_change(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  napi_value result;
  struct provider_exact_object_publisher *publisher = NULL;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !provider_exact_object_unwrap_publisher(env, argument, &publisher) ||
      publisher->closed || publisher->test_post_link_parent_change_armed ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
  }
  publisher->test_post_link_parent_change_armed = 1;
  return result;
}

static napi_value arm_test_provider_exact_object_pre_link_parent_aba(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 2;
  napi_value arguments[2];
  napi_value result;
  struct provider_exact_object_publisher *publisher = NULL;
  struct stat peer_metadata;
  char peer_path[PATH_MAX + 1];
  int peer_descriptor = -1;
  int admitted = 0;
  memset(&peer_metadata, 0, sizeof(peer_metadata));
  memset(peer_path, 0, sizeof(peer_path));
  if (napi_get_cb_info(env, info, &argument_count, arguments, NULL, NULL) !=
          napi_ok ||
      argument_count != 2 ||
      !provider_exact_object_unwrap_publisher(env, arguments[0], &publisher) ||
      !provider_exact_object_read_parent_path(env, arguments[1], peer_path) ||
      publisher->closed || publisher->outstanding_source == NULL ||
      publisher->test_pre_link_parent_aba_armed ||
      strcmp(peer_path, publisher->canonical_parent_path) == 0 ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    safe_git_secure_zero(peer_path, sizeof(peer_path));
    return throw_provider_exact_object_unavailable(env);
  }
#if defined(__linux__)
  peer_descriptor =
      open(peer_path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (peer_descriptor >= 0 && fstat(peer_descriptor, &peer_metadata) == 0 &&
      provider_exact_object_managed_parent_admitted(
          publisher, peer_descriptor, &peer_metadata) &&
      peer_metadata.st_dev ==
          publisher->nodes[publisher->node_count - 1].snapshot.st_dev) {
    admitted = 1;
  }
#endif
  if (peer_descriptor >= 0) (void)close(peer_descriptor);
  safe_git_secure_zero(&peer_metadata, sizeof(peer_metadata));
  if (!admitted) {
    safe_git_secure_zero(peer_path, sizeof(peer_path));
    return throw_provider_exact_object_unavailable(env);
  }
  memcpy(publisher->test_pre_link_parent_aba_peer_path, peer_path,
         strlen(peer_path) + 1);
  safe_git_secure_zero(peer_path, sizeof(peer_path));
  publisher->test_pre_link_parent_aba_armed = 1;
  return result;
}

static napi_value revalidate_provider_exact_object_publisher(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  napi_value result;
  struct provider_exact_object_publisher *publisher = NULL;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !provider_exact_object_unwrap_publisher(env, argument, &publisher) ||
      !provider_exact_object_revalidate_parent_chain(publisher) ||
      napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
  }
  return result;
}

static napi_value close_provider_exact_object_source(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  napi_value result;
  struct provider_exact_object_source *source = NULL;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !provider_exact_object_unwrap_source(env, argument, &source)) {
    return throw_provider_exact_object_unavailable(env);
  }
  provider_exact_object_source_release(env, source);
  if (napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
  }
  return result;
}

static napi_value close_provider_exact_object_publisher(
    napi_env env, napi_callback_info info) {
  size_t argument_count = 1;
  napi_value argument;
  napi_value result;
  struct provider_exact_object_publisher *publisher = NULL;
  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      !provider_exact_object_unwrap_publisher(env, argument, &publisher)) {
    return throw_provider_exact_object_unavailable(env);
  }
  provider_exact_object_publisher_release(publisher);
  if (napi_get_boolean(env, true, &result) != napi_ok) {
    return throw_provider_exact_object_unavailable(env);
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
      {"inspectInstallationEmptyHooksDirectory", NULL,
       inspect_installation_empty_hooks_directory, NULL, NULL, NULL,
       napi_default, NULL},
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
      {"armTestInstallationStateAuthorityNamespaceRace", NULL,
       arm_test_installation_state_authority_namespace_race, NULL, NULL, NULL,
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
      {"openProviderExactObjectPublisher", NULL,
       open_provider_exact_object_publisher, NULL, NULL, NULL, napi_default,
       NULL},
      {"revalidateProviderExactObjectPublisher", NULL,
       revalidate_provider_exact_object_publisher, NULL, NULL, NULL,
       napi_default, NULL},
      {"stageProviderExactObject", NULL, stage_provider_exact_object, NULL,
       NULL, NULL, napi_default, NULL},
      {"commitProviderExactObject", NULL, commit_provider_exact_object, NULL,
       NULL, NULL, napi_default, NULL},
      {"armTestProviderExactObjectParentFsyncFailure", NULL,
       arm_test_provider_exact_object_parent_fsync_failure, NULL, NULL, NULL,
       napi_default, NULL},
      {"armTestProviderExactObjectPostLinkParentChange", NULL,
       arm_test_provider_exact_object_post_link_parent_change, NULL, NULL,
       NULL, napi_default, NULL},
      {"armTestProviderExactObjectPreLinkParentAba", NULL,
       arm_test_provider_exact_object_pre_link_parent_aba, NULL, NULL, NULL,
       napi_default, NULL},
      {"closeProviderExactObjectSource", NULL,
       close_provider_exact_object_source, NULL, NULL, NULL, napi_default,
       NULL},
      {"closeProviderExactObjectPublisher", NULL,
       close_provider_exact_object_publisher, NULL, NULL, NULL, napi_default,
       NULL},
      {"openSafeGitDescriptorBootstrap", NULL,
       open_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default, NULL},
      {"revalidateSafeGitDescriptorBootstrap", NULL,
       revalidate_safe_git_descriptor_bootstrap, NULL, NULL, NULL, napi_default,
       NULL},
      {"armTestSafeGitEmptyHooksRace", NULL,
       arm_test_safe_git_empty_hooks_race, NULL, NULL, NULL, napi_default,
       NULL},
      {"armTestSafeGitExecutableOwnerAdmission", NULL,
       arm_test_safe_git_executable_owner_admission, NULL, NULL, NULL,
       napi_default, NULL},
      {"bindSafeGitRepositoryControl", NULL,
       bind_safe_git_repository_control, NULL, NULL, NULL, napi_default, NULL},
      {"bindSafeGitEmptyHooksDirectory", NULL,
       bind_safe_git_empty_hooks_directory, NULL, NULL, NULL, napi_default,
       NULL},
      {"bindSafeGitExecutable", NULL, bind_safe_git_executable, NULL, NULL,
       NULL, napi_default, NULL},
      {"executeSafeGitVersion", NULL, execute_safe_git_version, NULL, NULL,
       NULL, napi_default, NULL},
      {"executeSafeGitReadProfile", NULL, execute_safe_git_read_profile, NULL,
       NULL, NULL, napi_default, NULL},
      {"createSafeGitTaskBaselineLease", NULL,
       create_safe_git_task_baseline_lease, NULL, NULL, NULL, napi_default,
       NULL},
      {"recoverSafeGitTaskBaselineLease", NULL,
       create_safe_git_task_baseline_lease, NULL, NULL, NULL, napi_default,
       NULL},
      {"rollbackSafeGitTaskBaselineLease", NULL,
       create_safe_git_task_baseline_lease, NULL, NULL, NULL, napi_default,
       NULL},
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
