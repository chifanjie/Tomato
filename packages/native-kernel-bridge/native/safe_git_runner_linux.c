#define _GNU_SOURCE

#include "safe_git_runner_internal.h"
#include "safe_git_elf_closure_linux.h"

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/audit.h>
#include <linux/cgroupstats.h>
#include <linux/close_range.h>
#include <linux/filter.h>
#include <linux/landlock.h>
#include <linux/sched.h>
#include <linux/seccomp.h>
#include <poll.h>
#include <signal.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <sys/syscall.h>
#include <sys/sysmacros.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#ifndef CGROUP2_SUPER_MAGIC
#define CGROUP2_SUPER_MAGIC 0x63677270
#endif

#define SAFE_GIT_RUNNER_STDERR_LIMIT_V1 ((size_t)65536)
#define SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1 ((int64_t)2000000000)
#define SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1 ((int64_t)250000000)
#define SAFE_GIT_RUNNER_RSS_LIMIT_V1 ((uint64_t)536870912)
#define SAFE_GIT_RUNNER_AS_LIMIT_V1 ((rlim_t)2147483648ULL)
#define SAFE_GIT_RUNNER_CPU_LIMIT_V1 ((rlim_t)2)
#define SAFE_GIT_RUNNER_FD_LIMIT_V1 ((rlim_t)256)
#define SAFE_GIT_RUNNER_PROCESS_LIMIT_V1 ((rlim_t)1)
#define SAFE_GIT_RUNNER_FILE_TEXT_LIMIT_V1 ((size_t)16384)
#define SAFE_GIT_RUNNER_CGROUP_NAME_LIMIT_V1 ((size_t)80)
#define SAFE_GIT_RUNNER_EXEC_FD_V1 200
#define SAFE_GIT_RUNNER_SETUP_FD_V1 201
#define SAFE_GIT_RUNNER_EMPTY_HOOKS_FD_V1 202
#define SAFE_GIT_RUNNER_SUPERVISOR_CGROUP_V1 \
  "understand-code-safe-git-supervisor-v1"

struct safe_git_cgroup_v1 {
  int parent_fd;
  int payload_fd;
  int created;
  char payload_name[SAFE_GIT_RUNNER_CGROUP_NAME_LIMIT_V1];
};

struct safe_git_supervisor_v1 {
  pid_t child;
  int pidfd;
  int stdout_fd;
  int stderr_fd;
  int setup_fd;
  int child_reaped;
  int child_status;
  int setup_succeeded;
  size_t stdout_length;
  size_t stderr_length;
  unsigned char *stdout_bytes;
  size_t stdout_capacity;
};

static int64_t safe_git_monotonic_now_ns_v1(void) {
  struct timespec now;
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0) return -1;
  if (now.tv_sec > INT64_MAX / 1000000000LL) return -1;
  return (int64_t)now.tv_sec * 1000000000LL + now.tv_nsec;
}

static void safe_git_runner_secure_zero_v1(void *value, size_t length) {
  volatile unsigned char *bytes = value;
  while (length > 0) {
    *bytes++ = 0;
    length -= 1;
  }
}

static int safe_git_read_bounded_file_at_v1(int directory, const char *name,
                                            char *buffer, size_t capacity,
                                            size_t *length) {
  int descriptor = -1;
  size_t consumed = 0;
  if (capacity < 2) return 0;
  descriptor = openat(directory, name, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0) return 0;
  while (consumed < capacity) {
    ssize_t amount = read(descriptor, buffer + consumed, capacity - consumed);
    if (amount < 0 && errno == EINTR) continue;
    if (amount < 0) goto failure;
    if (amount == 0) break;
    consumed += (size_t)amount;
  }
  if (consumed == capacity) {
    unsigned char extra;
    ssize_t amount;
    do {
      amount = read(descriptor, &extra, 1);
    } while (amount < 0 && errno == EINTR);
    if (amount != 0) goto failure;
  }
  (void)close(descriptor);
  if (consumed == 0 || memchr(buffer, '\0', consumed) != NULL) return 0;
  buffer[consumed] = '\0';
  *length = consumed;
  return 1;

failure:
  (void)close(descriptor);
  return 0;
}

static int safe_git_write_exact_file_at_v1(int directory, const char *name,
                                           const char *value) {
  int descriptor = -1;
  size_t length = strlen(value);
  size_t consumed = 0;
  descriptor = openat(directory, name, O_WRONLY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0) return 0;
  while (consumed < length) {
    ssize_t amount = write(descriptor, value + consumed, length - consumed);
    if (amount < 0 && errno == EINTR) continue;
    if (amount <= 0) {
      (void)close(descriptor);
      return 0;
    }
    consumed += (size_t)amount;
  }
  return close(descriptor) == 0;
}

static int safe_git_file_equals_at_v1(int directory, const char *name,
                                      const char *expected) {
  char buffer[128];
  size_t length = 0;
  size_t expected_length = strlen(expected);
  memset(buffer, 0, sizeof(buffer));
  return safe_git_read_bounded_file_at_v1(directory, name, buffer,
                                          sizeof(buffer) - 1, &length) &&
         length == expected_length && memcmp(buffer, expected, length) == 0;
}

static int safe_git_word_list_contains_v1(const char *text, size_t length,
                                          const char *word) {
  size_t cursor = 0;
  size_t word_length = strlen(word);
  while (cursor < length) {
    size_t start;
    while (cursor < length &&
           (text[cursor] == ' ' || text[cursor] == '\n' ||
            text[cursor] == '\t')) {
      cursor += 1;
    }
    start = cursor;
    while (cursor < length && text[cursor] != ' ' && text[cursor] != '\n' &&
           text[cursor] != '\t') {
      cursor += 1;
    }
    if (cursor - start == word_length &&
        memcmp(text + start, word, word_length) == 0) {
      return 1;
    }
  }
  return 0;
}

static int safe_git_cgroup_fd_is_v2_v1(int descriptor) {
  struct statfs filesystem;
  return fstatfs(descriptor, &filesystem) == 0 &&
         (unsigned long)filesystem.f_type == (unsigned long)CGROUP2_SUPER_MAGIC;
}

static int safe_git_read_self_cgroup_path_v1(char *path, size_t capacity) {
  int proc = -1;
  char buffer[PATH_MAX + 32];
  size_t consumed = 0;
  const char *prefix = "0::";
  size_t line_length;
  memset(buffer, 0, sizeof(buffer));
  proc = open("/proc/self/cgroup", O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (proc < 0) return 0;
  while (consumed < sizeof(buffer) - 1) {
    ssize_t amount = read(proc, buffer + consumed,
                          sizeof(buffer) - 1 - consumed);
    if (amount < 0 && errno == EINTR) continue;
    if (amount < 0) {
      (void)close(proc);
      return 0;
    }
    if (amount == 0) break;
    consumed += (size_t)amount;
  }
  (void)close(proc);
  if (consumed < 5 || consumed == sizeof(buffer) - 1 ||
      memchr(buffer, '\0', consumed) != NULL || buffer[consumed - 1] != '\n' ||
      memchr(buffer, '\n', consumed - 1) != NULL ||
      memcmp(buffer, prefix, strlen(prefix)) != 0) {
    return 0;
  }
  line_length = consumed - 1 - strlen(prefix);
  if (line_length == 0 || line_length >= capacity ||
      buffer[strlen(prefix)] != '/') {
    return 0;
  }
  memcpy(path, buffer + strlen(prefix), line_length);
  path[line_length] = '\0';
  if (strstr(path, "//") != NULL || strstr(path, "/../") != NULL ||
      strstr(path, "/./") != NULL ||
      (line_length >= 3 && strcmp(path + line_length - 3, "/..") == 0) ||
      (line_length >= 2 && strcmp(path + line_length - 2, "/.") == 0)) {
    memset(path, 0, capacity);
    return 0;
  }
  {
    const char *leaf = strrchr(path, '/');
    if (leaf == NULL ||
        strcmp(leaf + 1, SAFE_GIT_RUNNER_SUPERVISOR_CGROUP_V1) != 0) {
      memset(path, 0, capacity);
      return 0;
    }
  }
  return 1;
}

static int safe_git_current_leaf_has_only_self_v1(int current_fd) {
  char buffer[128];
  char expected[64];
  size_t length = 0;
  int expected_length = snprintf(expected, sizeof(expected), "%ld\n",
                                 (long)getpid());
  memset(buffer, 0, sizeof(buffer));
  return expected_length > 0 && (size_t)expected_length < sizeof(expected) &&
         safe_git_read_bounded_file_at_v1(current_fd, "cgroup.procs", buffer,
                                          sizeof(buffer) - 1, &length) &&
         length == (size_t)expected_length &&
         memcmp(buffer, expected, length) == 0;
}

static int safe_git_cgroup_procs_is_empty_v1(int cgroup_fd) {
  unsigned char byte;
  ssize_t amount;
  int descriptor =
      openat(cgroup_fd, "cgroup.procs", O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0) return 0;
  do {
    amount = read(descriptor, &byte, 1);
  } while (amount < 0 && errno == EINTR);
  (void)close(descriptor);
  return amount == 0;
}

static int safe_git_probe_cgroup_control_write_v1(int cgroup_fd,
                                                   const char *name) {
  int descriptor =
      openat(cgroup_fd, name, O_WRONLY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0) return 0;
  return close(descriptor) == 0;
}

static int safe_git_delegated_root_has_only_supervisor_v1(
    int parent_fd, const struct stat *current_metadata) {
  DIR *directory = NULL;
  struct dirent *entry;
  int duplicate = fcntl(parent_fd, F_DUPFD_CLOEXEC, 3);
  size_t child_count = 0;
  int success = 0;
  if (duplicate < 0 || (directory = fdopendir(duplicate)) == NULL) {
    if (duplicate >= 0) (void)close(duplicate);
    return 0;
  }
  while ((entry = readdir(directory)) != NULL) {
    struct stat metadata;
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      continue;
    }
    if (fstatat(parent_fd, entry->d_name, &metadata, AT_SYMLINK_NOFOLLOW) != 0) {
      goto cleanup;
    }
    if (!S_ISDIR(metadata.st_mode)) continue;
    child_count += 1;
    if (strcmp(entry->d_name, SAFE_GIT_RUNNER_SUPERVISOR_CGROUP_V1) != 0 ||
        metadata.st_dev != current_metadata->st_dev ||
        metadata.st_ino != current_metadata->st_ino) {
      goto cleanup;
    }
  }
  success = child_count == 1;

cleanup:
  (void)closedir(directory);
  return success;
}

static int safe_git_open_current_cgroup_v1(void) {
  char path[PATH_MAX];
  int current = -1;
  int next = -1;
  size_t cursor = 1;
  size_t length;
  if (!safe_git_read_self_cgroup_path_v1(path, sizeof(path))) return -1;
  current = open("/sys/fs/cgroup",
                 O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (current < 0 || !safe_git_cgroup_fd_is_v2_v1(current)) goto failure;
  length = strlen(path);
  while (cursor < length) {
    size_t end = cursor;
    size_t component_length;
    char component[NAME_MAX + 1];
    struct stat metadata;
    while (end < length && path[end] != '/') end += 1;
    component_length = end - cursor;
    if (component_length == 0 || component_length > NAME_MAX) goto failure;
    memcpy(component, path + cursor, component_length);
    component[component_length] = '\0';
    next = openat(current, component,
                  O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0 || fstat(next, &metadata) != 0 ||
        !S_ISDIR(metadata.st_mode) || !safe_git_cgroup_fd_is_v2_v1(next)) {
      if (next >= 0) (void)close(next);
      goto failure;
    }
    (void)close(current);
    current = next;
    cursor = end + 1;
  }
  safe_git_runner_secure_zero_v1(path, sizeof(path));
  return current;

failure:
  if (current >= 0) (void)close(current);
  safe_git_runner_secure_zero_v1(path, sizeof(path));
  return -1;
}

static int safe_git_random_cgroup_name_v1(char *name, size_t capacity) {
  static const char hex[] = "0123456789abcdef";
  unsigned char random[16];
  size_t index;
  const char *prefix = "understand-code-safe-git-v1-";
  size_t prefix_length = strlen(prefix);
  ssize_t amount = syscall(SYS_getrandom, random, sizeof(random), 0);
  if (amount != (ssize_t)sizeof(random) ||
      prefix_length + sizeof(random) * 2 + 1 > capacity) {
    safe_git_runner_secure_zero_v1(random, sizeof(random));
    return 0;
  }
  memcpy(name, prefix, prefix_length);
  for (index = 0; index < sizeof(random); index += 1) {
    name[prefix_length + index * 2] = hex[random[index] >> 4U];
    name[prefix_length + index * 2 + 1] = hex[random[index] & 0x0fU];
  }
  name[prefix_length + sizeof(random) * 2] = '\0';
  safe_git_runner_secure_zero_v1(random, sizeof(random));
  return 1;
}

static int safe_git_close_cgroup_v1(struct safe_git_cgroup_v1 *cgroup) {
  int success = 1;
  if (cgroup->payload_fd >= 0) (void)close(cgroup->payload_fd);
  cgroup->payload_fd = -1;
  if (cgroup->created && cgroup->parent_fd >= 0 &&
      cgroup->payload_name[0] != '\0') {
    if (unlinkat(cgroup->parent_fd, cgroup->payload_name, AT_REMOVEDIR) != 0) {
      success = 0;
    }
  }
  if (cgroup->parent_fd >= 0) (void)close(cgroup->parent_fd);
  safe_git_runner_secure_zero_v1(cgroup, sizeof(*cgroup));
  cgroup->parent_fd = -1;
  cgroup->payload_fd = -1;
  return success;
}

static int safe_git_prepare_cgroup_v1(struct safe_git_cgroup_v1 *cgroup) {
  int current = -1;
  int parent = -1;
  char controllers[512];
  char subtree[512];
  size_t controllers_length = 0;
  size_t subtree_length = 0;
  struct stat current_metadata;
  struct stat parent_metadata;
  uid_t effective_uid = geteuid();

  memset(cgroup, 0, sizeof(*cgroup));
  cgroup->parent_fd = -1;
  cgroup->payload_fd = -1;
  memset(controllers, 0, sizeof(controllers));
  memset(subtree, 0, sizeof(subtree));
  current = safe_git_open_current_cgroup_v1();
  if (current < 0 || fstat(current, &current_metadata) != 0 ||
      !safe_git_current_leaf_has_only_self_v1(current)) {
    goto failure;
  }
  parent = openat(current, "..",
                  O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (parent < 0 || fstat(parent, &parent_metadata) != 0 ||
      !safe_git_cgroup_fd_is_v2_v1(parent) ||
      current_metadata.st_uid != effective_uid ||
      parent_metadata.st_uid != effective_uid ||
      (current_metadata.st_mode & (S_IWGRP | S_IWOTH)) != 0 ||
      (parent_metadata.st_mode & (S_IWGRP | S_IWOTH)) != 0 ||
      (current_metadata.st_dev == parent_metadata.st_dev &&
       current_metadata.st_ino == parent_metadata.st_ino) ||
      !safe_git_read_bounded_file_at_v1(
          parent, "cgroup.controllers", controllers,
          sizeof(controllers) - 1, &controllers_length) ||
      !safe_git_read_bounded_file_at_v1(
          parent, "cgroup.subtree_control", subtree, sizeof(subtree) - 1,
          &subtree_length) ||
      !safe_git_word_list_contains_v1(controllers, controllers_length,
                                      "memory") ||
      !safe_git_word_list_contains_v1(controllers, controllers_length, "pids") ||
      !safe_git_word_list_contains_v1(subtree, subtree_length, "memory") ||
      !safe_git_word_list_contains_v1(subtree, subtree_length, "pids") ||
      !safe_git_cgroup_procs_is_empty_v1(parent) ||
      !safe_git_probe_cgroup_control_write_v1(parent, "cgroup.procs") ||
      !safe_git_probe_cgroup_control_write_v1(parent,
                                              "cgroup.subtree_control") ||
      !safe_git_delegated_root_has_only_supervisor_v1(
          parent, &current_metadata) ||
      !safe_git_random_cgroup_name_v1(cgroup->payload_name,
                                      sizeof(cgroup->payload_name)) ||
      mkdirat(parent, cgroup->payload_name, 0700) != 0) {
    goto failure;
  }
  cgroup->created = 1;
  cgroup->parent_fd = parent;
  parent = -1;
  cgroup->payload_fd =
      openat(cgroup->parent_fd, cgroup->payload_name,
             O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (cgroup->payload_fd < 0 ||
      !safe_git_cgroup_fd_is_v2_v1(cgroup->payload_fd) ||
      !safe_git_write_exact_file_at_v1(cgroup->payload_fd, "memory.max",
                                       "536870912") ||
      !safe_git_write_exact_file_at_v1(cgroup->payload_fd, "memory.swap.max",
                                       "0") ||
      !safe_git_write_exact_file_at_v1(cgroup->payload_fd, "memory.oom.group",
                                       "1") ||
      !safe_git_write_exact_file_at_v1(cgroup->payload_fd, "pids.max", "1") ||
      !safe_git_file_equals_at_v1(cgroup->payload_fd, "memory.max",
                                  "536870912\n") ||
      !safe_git_file_equals_at_v1(cgroup->payload_fd, "memory.swap.max", "0\n") ||
      !safe_git_file_equals_at_v1(cgroup->payload_fd, "memory.oom.group", "1\n") ||
      !safe_git_file_equals_at_v1(cgroup->payload_fd, "pids.max", "1\n") ||
      faccessat(cgroup->payload_fd, "cgroup.kill", W_OK, 0) != 0 ||
      faccessat(cgroup->payload_fd, "memory.peak", R_OK, 0) != 0 ||
      faccessat(cgroup->payload_fd, "memory.events", R_OK, 0) != 0 ||
      faccessat(cgroup->payload_fd, "pids.events", R_OK, 0) != 0) {
    goto failure;
  }
  (void)close(current);
  return 1;

failure:
  if (current >= 0) (void)close(current);
  if (parent >= 0) (void)close(parent);
  (void)safe_git_close_cgroup_v1(cgroup);
  return 0;
}

static int safe_git_parse_named_counter_v1(const char *text, size_t length,
                                           const char *name,
                                           uint64_t *value) {
  size_t cursor = 0;
  size_t name_length = strlen(name);
  while (cursor < length) {
    size_t start = cursor;
    size_t number_start;
    uint64_t parsed = 0;
    while (cursor < length && text[cursor] != ' ' && text[cursor] != '\n') {
      cursor += 1;
    }
    if (cursor >= length || text[cursor] != ' ') {
      while (cursor < length && text[cursor++] != '\n') {
      }
      continue;
    }
    number_start = ++cursor;
    while (cursor < length && text[cursor] >= '0' && text[cursor] <= '9') {
      uint64_t digit = (uint64_t)(text[cursor] - '0');
      if (parsed > (UINT64_MAX - digit) / 10U) return 0;
      parsed = parsed * 10U + digit;
      cursor += 1;
    }
    if (cursor == number_start ||
        (cursor < length && text[cursor] != '\n')) {
      return 0;
    }
    if (cursor - number_start > 1 && text[number_start] == '0') return 0;
    if (number_start - 1 - start == name_length &&
        memcmp(text + start, name, name_length) == 0) {
      *value = parsed;
      return 1;
    }
    if (cursor < length) cursor += 1;
  }
  return 0;
}

static int safe_git_read_uint_file_at_v1(int directory, const char *name,
                                         uint64_t *value) {
  char buffer[128];
  size_t length = 0;
  size_t cursor = 0;
  uint64_t parsed = 0;
  memset(buffer, 0, sizeof(buffer));
  if (!safe_git_read_bounded_file_at_v1(directory, name, buffer,
                                        sizeof(buffer) - 1, &length) ||
      length < 2 || buffer[length - 1] != '\n') {
    return 0;
  }
  while (cursor + 1 < length && buffer[cursor] >= '0' &&
         buffer[cursor] <= '9') {
    uint64_t digit = (uint64_t)(buffer[cursor] - '0');
    if (parsed > (UINT64_MAX - digit) / 10U) return 0;
    parsed = parsed * 10U + digit;
    cursor += 1;
  }
  if (cursor == 0 || cursor + 1 != length ||
      (cursor > 1 && buffer[0] == '0')) {
    return 0;
  }
  *value = parsed;
  return 1;
}

static int safe_git_cgroup_empty_v1(int cgroup_fd) {
  return safe_git_file_equals_at_v1(cgroup_fd, "pids.current", "0\n");
}

static void safe_git_fail_stop_if_cleanup_incomplete_v1(
    const struct safe_git_supervisor_v1 *supervisor,
    const struct safe_git_cgroup_v1 *cgroup) {
  if (!supervisor->child_reaped || cgroup->payload_fd < 0 ||
      !safe_git_cgroup_empty_v1(cgroup->payload_fd)) {
    _exit(127);
  }
}

#ifdef SAFE_GIT_RUNNER_TESTING
int safe_git_runner_test_incomplete_cleanup_fail_stop_v1(void) {
  struct safe_git_supervisor_v1 supervisor;
  struct safe_git_cgroup_v1 cgroup;
  memset(&supervisor, 0, sizeof(supervisor));
  memset(&cgroup, 0, sizeof(cgroup));
  cgroup.payload_fd = -1;
  safe_git_fail_stop_if_cleanup_incomplete_v1(&supervisor, &cgroup);
  return 0;
}
#endif

static int safe_git_cgroup_has_exact_pid_v1(int cgroup_fd, pid_t child) {
  char expected[64];
  char observed[128];
  size_t observed_length = 0;
  int expected_length =
      snprintf(expected, sizeof(expected), "%ld\n", (long)child);
  memset(observed, 0, sizeof(observed));
  return expected_length > 0 && (size_t)expected_length < sizeof(expected) &&
         safe_git_read_bounded_file_at_v1(cgroup_fd, "cgroup.procs", observed,
                                          sizeof(observed) - 1,
                                          &observed_length) &&
         observed_length == (size_t)expected_length &&
         memcmp(observed, expected, observed_length) == 0;
}

static int safe_git_cgroup_resource_result_v1(int cgroup_fd,
                                              int *resource_limited) {
  char memory_events[2048];
  char pids_events[1024];
  size_t memory_length = 0;
  size_t pids_length = 0;
  uint64_t memory_peak = 0;
  uint64_t memory_max_events = 0;
  uint64_t oom = 0;
  uint64_t oom_kill = 0;
  uint64_t pids_max_events = 0;
  memset(memory_events, 0, sizeof(memory_events));
  memset(pids_events, 0, sizeof(pids_events));
  if (!safe_git_cgroup_empty_v1(cgroup_fd) ||
      !safe_git_read_uint_file_at_v1(cgroup_fd, "memory.peak", &memory_peak) ||
      !safe_git_read_bounded_file_at_v1(
          cgroup_fd, "memory.events", memory_events,
          sizeof(memory_events) - 1, &memory_length) ||
      !safe_git_read_bounded_file_at_v1(cgroup_fd, "pids.events", pids_events,
                                        sizeof(pids_events) - 1,
                                        &pids_length) ||
      !safe_git_parse_named_counter_v1(memory_events, memory_length, "max",
                                       &memory_max_events) ||
      !safe_git_parse_named_counter_v1(memory_events, memory_length, "oom",
                                       &oom) ||
      !safe_git_parse_named_counter_v1(memory_events, memory_length, "oom_kill",
                                       &oom_kill) ||
      !safe_git_parse_named_counter_v1(pids_events, pids_length, "max",
                                       &pids_max_events)) {
    return 0;
  }
  *resource_limited = memory_peak > SAFE_GIT_RUNNER_RSS_LIMIT_V1 ||
                      memory_max_events != 0 || oom != 0 || oom_kill != 0 ||
                      pids_max_events != 0;
  return 1;
}

#ifndef LANDLOCK_ACCESS_FS_REFER
#define LANDLOCK_ACCESS_FS_REFER (1ULL << 13)
#endif
#ifndef LANDLOCK_ACCESS_FS_TRUNCATE
#define LANDLOCK_ACCESS_FS_TRUNCATE (1ULL << 14)
#endif
#ifndef LANDLOCK_ACCESS_NET_BIND_TCP
#define LANDLOCK_ACCESS_NET_BIND_TCP (1ULL << 0)
#endif
#ifndef LANDLOCK_ACCESS_NET_CONNECT_TCP
#define LANDLOCK_ACCESS_NET_CONNECT_TCP (1ULL << 1)
#endif

static uint64_t safe_git_landlock_handled_access_v1(void) {
  return LANDLOCK_ACCESS_FS_EXECUTE | LANDLOCK_ACCESS_FS_WRITE_FILE |
         LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR |
         LANDLOCK_ACCESS_FS_REMOVE_DIR | LANDLOCK_ACCESS_FS_REMOVE_FILE |
         LANDLOCK_ACCESS_FS_MAKE_CHAR | LANDLOCK_ACCESS_FS_MAKE_DIR |
         LANDLOCK_ACCESS_FS_MAKE_REG | LANDLOCK_ACCESS_FS_MAKE_SOCK |
         LANDLOCK_ACCESS_FS_MAKE_FIFO | LANDLOCK_ACCESS_FS_MAKE_BLOCK |
         LANDLOCK_ACCESS_FS_MAKE_SYM | LANDLOCK_ACCESS_FS_REFER |
         LANDLOCK_ACCESS_FS_TRUNCATE;
}

static int safe_git_add_landlock_path_rule_v1(int ruleset, int descriptor,
                                               uint64_t allowed_access) {
  struct landlock_path_beneath_attr rule;
  memset(&rule, 0, sizeof(rule));
  rule.parent_fd = descriptor;
  rule.allowed_access = allowed_access;
  return syscall(SYS_landlock_add_rule, ruleset, LANDLOCK_RULE_PATH_BENEATH,
                 &rule, 0) == 0;
}

static int safe_git_install_landlock_v1(
    const struct safe_git_elf_closure_v1 *closure, int dev_null_fd,
    const int *read_authority_fds, size_t read_authority_count,
    int write_authority_fd) {
  struct landlock_ruleset_attr ruleset_attributes;
  int ruleset = -1;
  size_t index;
  memset(&ruleset_attributes, 0, sizeof(ruleset_attributes));
  ruleset_attributes.handled_access_fs = safe_git_landlock_handled_access_v1();
  /* No LANDLOCK_RULE_NET_PORT rule is installed: all TCP bind/connect deny. */
  ruleset_attributes.handled_access_net = LANDLOCK_ACCESS_NET_BIND_TCP |
                                          LANDLOCK_ACCESS_NET_CONNECT_TCP;
  ruleset = (int)syscall(SYS_landlock_create_ruleset, &ruleset_attributes,
                         sizeof(ruleset_attributes), 0);
  if (ruleset < 0) return 0;
  for (index = 0; index < closure->file_count; index += 1) {
    uint64_t allowed_access = LANDLOCK_ACCESS_FS_READ_FILE;
    if (closure->files[index].allow_execute) {
      allowed_access |= LANDLOCK_ACCESS_FS_EXECUTE;
    }
    if (!safe_git_add_landlock_path_rule_v1(
            ruleset, closure->files[index].path_fd, allowed_access)) {
      (void)close(ruleset);
      return 0;
    }
  }
  for (index = 0; index < read_authority_count; index += 1) {
    if (read_authority_fds == NULL || read_authority_fds[index] < 0 ||
        !safe_git_add_landlock_path_rule_v1(
            ruleset, read_authority_fds[index],
            LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR)) {
      (void)close(ruleset);
      return 0;
    }
  }
  if (write_authority_fd >= 0 &&
      !safe_git_add_landlock_path_rule_v1(
          ruleset, write_authority_fd,
          LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_READ_DIR |
              LANDLOCK_ACCESS_FS_WRITE_FILE |
              LANDLOCK_ACCESS_FS_REMOVE_FILE | LANDLOCK_ACCESS_FS_MAKE_REG |
              LANDLOCK_ACCESS_FS_REFER | LANDLOCK_ACCESS_FS_TRUNCATE)) {
    (void)close(ruleset);
    return 0;
  }
  {
    /*
     * Git opens the explicitly configured /dev/null config endpoints with
     * O_RDWR even for `--version`. This is the sole writable inode in the
     * profile; every other write remains denied by the empty Landlock policy.
     */
    if (!safe_git_add_landlock_path_rule_v1(
            ruleset, dev_null_fd,
            LANDLOCK_ACCESS_FS_READ_FILE | LANDLOCK_ACCESS_FS_WRITE_FILE)) {
      (void)close(ruleset);
      return 0;
    }
  }
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0 ||
      syscall(SYS_landlock_restrict_self, ruleset, 0) != 0) {
    (void)close(ruleset);
    return 0;
  }
  (void)close(ruleset);
  return 1;
}

static int safe_git_landlock_negative_write_test_v1(void) {
  int descriptor;
  errno = 0;
  /* O_RDWR is deliberately admissible to seccomp for the exact /dev/null
   * rule. A denial here therefore proves Landlock, rather than the syscall
   * filter, rejected a different device inode. */
  descriptor = open("/dev/zero", O_RDWR | O_NOCTTY | O_CLOEXEC);
  if (descriptor >= 0) {
    (void)close(descriptor);
    return 0;
  }
  return errno == EACCES || errno == EPERM;
}

static int safe_git_set_exact_limit_v1(int resource, rlim_t value) {
  struct rlimit desired;
  struct rlimit observed;
  desired.rlim_cur = value;
  desired.rlim_max = value;
  return setrlimit(resource, &desired) == 0 &&
         getrlimit(resource, &observed) == 0 &&
         observed.rlim_cur == value && observed.rlim_max == value;
}

static int safe_git_install_resource_limits_v1(int repository_write_profile) {
  /*
   * Linux does not enforce RLIMIT_RSS. The authoritative resident-memory
   * containment is the separately installed/read-back cgroup memory.max;
   * memory.peak and memory.events are checked after the payload is empty.
   */
  return safe_git_set_exact_limit_v1(RLIMIT_CPU,
                                     SAFE_GIT_RUNNER_CPU_LIMIT_V1) &&
         safe_git_set_exact_limit_v1(RLIMIT_AS, SAFE_GIT_RUNNER_AS_LIMIT_V1) &&
         safe_git_set_exact_limit_v1(RLIMIT_NPROC,
                                     SAFE_GIT_RUNNER_PROCESS_LIMIT_V1) &&
         safe_git_set_exact_limit_v1(RLIMIT_NOFILE,
                                     SAFE_GIT_RUNNER_FD_LIMIT_V1) &&
         safe_git_set_exact_limit_v1(RLIMIT_CORE, 0) &&
         safe_git_set_exact_limit_v1(
             RLIMIT_FSIZE, repository_write_profile ? (rlim_t)4096 : 0);
}

static int safe_git_filter_append_v1(struct sock_filter *filters,
                                     size_t capacity, size_t *count,
                                     struct sock_filter instruction) {
  if (*count >= capacity) return 0;
  filters[*count] = instruction;
  *count += 1;
  return 1;
}

static int safe_git_filter_allow_syscall_v1(struct sock_filter *filters,
                                            size_t capacity, size_t *count,
                                            int syscall_number) {
  return safe_git_filter_append_v1(
             filters, capacity, count,
             (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                          (uint32_t)syscall_number, 0, 1)) &&
         safe_git_filter_append_v1(
             filters, capacity, count,
             (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                          SECCOMP_RET_ALLOW));
}

static int safe_git_filter_allow_output_syscall_v1(
    struct sock_filter *filters, size_t capacity, size_t *count,
    int syscall_number, int allow_setup_fd) {
  size_t branch = *count;
  size_t high_check;
  size_t stdout_check;
  size_t stderr_check;
  size_t setup_check = SIZE_MAX;
  size_t error;
  size_t allowed;
  size_t after;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)syscall_number, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0]) + 4))) {
    return 0;
  }
  high_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0])))) {
    return 0;
  }
  stdout_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       STDOUT_FILENO, 0, 0))) {
    return 0;
  }
  stderr_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       STDERR_FILENO, 0, 0))) {
    return 0;
  }
  if (allow_setup_fd) {
    setup_check = *count;
    if (!safe_git_filter_append_v1(
            filters, capacity, count,
            (struct sock_filter)BPF_JUMP(
                BPF_JMP | BPF_JEQ | BPF_K, SAFE_GIT_RUNNER_SETUP_FD_V1, 0,
                0))) {
      return 0;
    }
  }
  error = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  allowed = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ALLOW))) {
    return 0;
  }
  after = *count;
  if (after - branch - 1 > UINT8_MAX || error - high_check - 1 > UINT8_MAX ||
      allowed - stdout_check - 1 > UINT8_MAX ||
      allowed - stderr_check - 1 > UINT8_MAX ||
      (allow_setup_fd && allowed - setup_check - 1 > UINT8_MAX)) {
    return 0;
  }
  filters[branch].jf = (uint8_t)(after - branch - 1);
  filters[high_check].jf = (uint8_t)(error - high_check - 1);
  filters[stdout_check].jt = (uint8_t)(allowed - stdout_check - 1);
  filters[stderr_check].jt = (uint8_t)(allowed - stderr_check - 1);
  if (allow_setup_fd) {
    filters[setup_check].jt = (uint8_t)(allowed - setup_check - 1);
  }
  return 1;
}

static int safe_git_filter_allow_prctl_queries_v1(
    struct sock_filter *filters, size_t capacity, size_t *count) {
  size_t branch = *count;
  size_t high_check;
  size_t get_seccomp;
  size_t get_no_new_privs;
  size_t error;
  size_t allowed;
  size_t after;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)__NR_prctl, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0]) + 4))) {
    return 0;
  }
  high_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0])))) {
    return 0;
  }
  get_seccomp = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       PR_GET_SECCOMP, 0, 0))) {
    return 0;
  }
  get_no_new_privs = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       PR_GET_NO_NEW_PRIVS, 0, 0))) {
    return 0;
  }
  error = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  allowed = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ALLOW))) {
    return 0;
  }
  after = *count;
  if (after - branch - 1 > UINT8_MAX || error - high_check - 1 > UINT8_MAX ||
      allowed - get_seccomp - 1 > UINT8_MAX ||
      allowed - get_no_new_privs - 1 > UINT8_MAX ||
      error - get_no_new_privs - 1 > UINT8_MAX) {
    return 0;
  }
  filters[branch].jf = (uint8_t)(after - branch - 1);
  filters[high_check].jf = (uint8_t)(error - high_check - 1);
  filters[get_seccomp].jt = (uint8_t)(allowed - get_seccomp - 1);
  filters[get_no_new_privs].jt =
      (uint8_t)(allowed - get_no_new_privs - 1);
  filters[get_no_new_privs].jf =
      (uint8_t)(error - get_no_new_privs - 1);
  return 1;
}

#ifdef __NR_faccessat
static int safe_git_filter_allow_faccessat_loader_probe_v1(
    struct sock_filter *filters, size_t capacity, size_t *count) {
  size_t branch = *count;
  size_t directory_check;
  size_t mode_high_check;
  size_t mode_check;
  size_t error;
  size_t allowed;
  size_t after;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)__NR_faccessat, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0])))) {
    return 0;
  }
  directory_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)AT_FDCWD, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[2]) + 4))) {
    return 0;
  }
  mode_high_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[2])))) {
    return 0;
  }
  mode_check = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, R_OK, 0,
                                       0))) {
    return 0;
  }
  error = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  allowed = *count;
  if (!safe_git_filter_append_v1(
          filters, capacity, count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ALLOW))) {
    return 0;
  }
  after = *count;
  if (after - branch - 1 > UINT8_MAX ||
      error - directory_check - 1 > UINT8_MAX ||
      error - mode_high_check - 1 > UINT8_MAX ||
      allowed - mode_check - 1 > UINT8_MAX ||
      error - mode_check - 1 > UINT8_MAX) {
    return 0;
  }
  filters[branch].jf = (uint8_t)(after - branch - 1);
  filters[directory_check].jf =
      (uint8_t)(error - directory_check - 1);
  filters[mode_high_check].jf =
      (uint8_t)(error - mode_high_check - 1);
  filters[mode_check].jt = (uint8_t)(allowed - mode_check - 1);
  filters[mode_check].jf = (uint8_t)(error - mode_check - 1);
  return 1;
}
#endif

static int safe_git_install_seccomp_v1(int executable_fd,
                                       int repository_read_profile,
                                       int repository_write_profile) {
  struct sock_filter filters[256];
  struct sock_fprog program;
  size_t count = 0;
  size_t exec_branch;
  size_t exec_fd_low;
  size_t exec_fd_high;
  size_t exec_flags_low;
  size_t exec_flags_high;
  size_t exec_error;
  size_t exec_after;
  size_t open_branch;
  size_t open_high;
  size_t open_forbidden;
  size_t open_write_only;
  size_t open_invalid_mode;
  size_t open_error;
  size_t open_after;
  size_t stat_branch;
  size_t stat_cwd;
  size_t stat_flags_high;
  size_t stat_flags;
  size_t stat_error;
  size_t stat_allowed;
  size_t stat_after;
  uint32_t forbidden_open_flags = repository_write_profile
                                      ? (uint32_t)(O_PATH |
                                                   (O_TMPFILE & ~O_DIRECTORY))
                                      : (uint32_t)(O_CREAT | O_EXCL | O_TRUNC |
                                                   O_APPEND | O_PATH |
                                                   (O_TMPFILE & ~O_DIRECTORY));
#if defined(__x86_64__)
  const uint32_t audit_architecture = AUDIT_ARCH_X86_64;
#elif defined(__aarch64__)
  const uint32_t audit_architecture = AUDIT_ARCH_AARCH64;
#else
  return 0;
#endif

  memset(filters, 0, sizeof(filters));
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, arch))) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       audit_architecture, 1, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_KILL_PROCESS)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, nr)))) {
    return 0;
  }

  /* execveat is admitted only for the retained Git descriptor + AT_EMPTY_PATH. */
  exec_branch = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)__NR_execveat, 0, 0))) {
    return 0;
  }
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0])))) {
    return 0;
  }
  exec_fd_low = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)executable_fd, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0]) + 4))) {
    return 0;
  }
  exec_fd_high = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[4])))) {
    return 0;
  }
  exec_flags_low = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)AT_EMPTY_PATH, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[4]) + 4))) {
    return 0;
  }
  exec_flags_high = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW))) {
    return 0;
  }
  exec_error = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  exec_after = count;
  if (exec_after - exec_branch - 1 > UINT8_MAX ||
      exec_error - exec_fd_low - 1 > UINT8_MAX ||
      exec_error - exec_fd_high - 1 > UINT8_MAX ||
      exec_error - exec_flags_low - 1 > UINT8_MAX ||
      exec_error - exec_flags_high - 1 > UINT8_MAX) {
    return 0;
  }
  filters[exec_branch].jf = (uint8_t)(exec_after - exec_branch - 1);
  filters[exec_fd_low].jf = (uint8_t)(exec_error - exec_fd_low - 1);
  filters[exec_fd_high].jf = (uint8_t)(exec_error - exec_fd_high - 1);
  filters[exec_flags_low].jf = (uint8_t)(exec_error - exec_flags_low - 1);
  filters[exec_flags_high].jf =
      (uint8_t)(exec_error - exec_flags_high - 1);

  /* openat may only request a non-mutating read, or O_RDWR for the exact
   * /dev/null inode admitted by Landlock. Repository reads additionally need
   * directory streams, still constrained to the retained Landlock subtrees. */
  if (!repository_read_profile) forbidden_open_flags |= (uint32_t)O_DIRECTORY;
  open_branch = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)__NR_openat, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[2]) + 4))) {
    return 0;
  }
  open_high = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[2])))) {
    return 0;
  }
  open_forbidden = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(
              BPF_JMP | BPF_JSET | BPF_K,
              forbidden_open_flags,
              0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[2]))) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_ALU | BPF_AND | BPF_K,
                                       O_ACCMODE))) {
    return 0;
  }
  open_write_only = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, O_WRONLY, 0,
                                       0))) {
    return 0;
  }
  open_invalid_mode = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, O_ACCMODE, 0,
                                       0))) {
    return 0;
  }
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW))) {
    return 0;
  }
  open_error = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  open_after = count;
  if (open_after - open_branch - 1 > UINT8_MAX ||
      open_error - open_high - 1 > UINT8_MAX ||
      open_error - open_forbidden - 1 > UINT8_MAX ||
      open_error - open_write_only - 1 > UINT8_MAX ||
      open_error - open_invalid_mode - 1 > UINT8_MAX) {
    return 0;
  }
  filters[open_branch].jf = (uint8_t)(open_after - open_branch - 1);
  filters[open_high].jf = (uint8_t)(open_error - open_high - 1);
  filters[open_forbidden].jt =
      (uint8_t)(open_error - open_forbidden - 1);
  filters[open_write_only].jt = repository_write_profile
                                    ? 0
                                    : (uint8_t)(open_error - open_write_only - 1);
  filters[open_invalid_mode].jt =
      (uint8_t)(open_error - open_invalid_mode - 1);

  /* The version probe has no repository pathname authority, so it admits only
   * descriptor metadata. Frozen repository reads run a pinned Git binary with
   * fixed argv and require pathname metadata inside the retained Landlock
   * subtrees; that profile admits newfstatat below with the other read calls. */
  if (!repository_read_profile) {
    stat_branch = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)__NR_newfstatat, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[0])))) {
    return 0;
  }
  stat_cwd = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       (uint32_t)AT_FDCWD, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[3]) + 4))) {
    return 0;
  }
  stat_flags_high = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 0)) ||
      !safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(
              BPF_LD | BPF_W | BPF_ABS,
              (uint32_t)offsetof(struct seccomp_data, args[3])))) {
    return 0;
  }
  stat_flags = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K,
                                       AT_EMPTY_PATH, 0, 0))) {
    return 0;
  }
  stat_error = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA)))) {
    return 0;
  }
  stat_allowed = count;
  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW))) {
    return 0;
  }
  stat_after = count;
  if (stat_after - stat_branch - 1 > UINT8_MAX ||
      stat_error - stat_cwd - 1 > UINT8_MAX ||
      stat_error - stat_flags_high - 1 > UINT8_MAX ||
      stat_allowed - stat_flags - 1 > UINT8_MAX) {
    return 0;
  }
  filters[stat_branch].jf = (uint8_t)(stat_after - stat_branch - 1);
  filters[stat_cwd].jt = (uint8_t)(stat_error - stat_cwd - 1);
  filters[stat_flags_high].jf =
      (uint8_t)(stat_error - stat_flags_high - 1);
    filters[stat_flags].jt = (uint8_t)(stat_allowed - stat_flags - 1);
  }

  if (!safe_git_filter_allow_prctl_queries_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count)
#ifdef __NR_faccessat
      || (!repository_read_profile &&
          !safe_git_filter_allow_faccessat_loader_probe_v1(
              filters, sizeof(filters) / sizeof(filters[0]), &count))
#endif
      || (!repository_write_profile &&
          (!safe_git_filter_allow_output_syscall_v1(
               filters, sizeof(filters) / sizeof(filters[0]), &count,
               __NR_write, 1) ||
           !safe_git_filter_allow_output_syscall_v1(
               filters, sizeof(filters) / sizeof(filters[0]), &count,
               __NR_writev, 0)))) {
    return 0;
  }

#define SAFE_GIT_ALLOW_SYSCALL_V1(name)                                      \
  do {                                                                       \
    if (!safe_git_filter_allow_syscall_v1(                                   \
            filters, sizeof(filters) / sizeof(filters[0]), &count, name)) {  \
      return 0;                                                              \
    }                                                                        \
  } while (0)

  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_read);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_readv);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_pread64);
  if (repository_write_profile) {
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_write);
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_writev);
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_fsync);
#ifdef __NR_fdatasync
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_fdatasync);
#endif
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_unlinkat);
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_renameat);
#ifdef __NR_renameat2
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_renameat2);
#endif
  }
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_close);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_lseek);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_fstat);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_fstatfs);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_fcntl);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_ioctl);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_mmap);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_mprotect);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_munmap);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_mremap);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_madvise);
#ifdef __NR_msync
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_msync);
#endif
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_brk);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_rt_sigaction);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_rt_sigprocmask);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_rt_sigreturn);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_sigaltstack);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_futex);
#ifdef __NR_rseq
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_rseq);
#endif
#ifdef __NR_membarrier
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_membarrier);
#endif
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_set_tid_address);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_set_robust_list);
#ifdef __NR_arch_prctl
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_arch_prctl);
#endif
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getpid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getppid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_gettid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getuid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_geteuid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getgid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getegid);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getcwd);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_uname);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_sysinfo);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getrandom);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_clock_gettime);
#ifdef __NR_clock_getres
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_clock_getres);
#endif
#ifdef __NR_clock_nanosleep
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_clock_nanosleep);
#endif
#ifdef __NR_nanosleep
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_nanosleep);
#endif
#ifdef __NR_gettimeofday
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_gettimeofday);
#endif
#ifdef __NR_times
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_times);
#endif
#ifdef __NR_sched_getaffinity
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_sched_getaffinity);
#endif
#ifdef __NR_sched_yield
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_sched_yield);
#endif
#ifdef __NR_getcpu
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getcpu);
#endif
#ifdef __NR_getrlimit
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getrlimit);
#endif
#ifdef __NR_prlimit64
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_prlimit64);
#endif
#ifdef __NR_restart_syscall
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_restart_syscall);
#endif
#ifdef __NR_umask
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_umask);
#endif
  if (repository_read_profile) {
    /* Git's worktree setup performs one pathname chdir back to the already
       retained repository root even when the process starts there. The fixed
       executable/argv and read-only Landlock authority keep this from
       becoming caller-selected filesystem authority. */
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_chdir);
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_newfstatat);
#ifdef __NR_statx
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_statx);
#endif
#ifdef __NR_getdents64
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_getdents64);
#endif
#ifdef __NR_readlink
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_readlink);
#endif
#ifdef __NR_readlinkat
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_readlinkat);
#endif
#ifdef __NR_access
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_access);
#endif
#ifdef __NR_faccessat
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_faccessat);
#endif
#ifdef __NR_faccessat2
    SAFE_GIT_ALLOW_SYSCALL_V1(__NR_faccessat2);
#endif
  }
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_exit);
  SAFE_GIT_ALLOW_SYSCALL_V1(__NR_exit_group);
#undef SAFE_GIT_ALLOW_SYSCALL_V1

  if (!safe_git_filter_append_v1(
          filters, sizeof(filters) / sizeof(filters[0]), &count,
          (struct sock_filter)BPF_STMT(BPF_RET | BPF_K,
                                       SECCOMP_RET_ERRNO |
                                           (EPERM & SECCOMP_RET_DATA))) ||
      count > USHRT_MAX) {
    return 0;
  }
  program.len = (unsigned short)count;
  program.filter = filters;
  return syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, 0, &program) == 0 &&
         prctl(PR_GET_SECCOMP, 0, 0, 0, 0) == SECCOMP_MODE_FILTER &&
         prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) == 1;
}

static int safe_git_seccomp_negative_tests_v1(int repository_read_profile,
                                              int repository_write_profile) {
  struct stat metadata;
  int descriptor;
  errno = 0;
  descriptor = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (descriptor >= 0) {
    (void)close(descriptor);
    return 0;
  }
  if (errno != EPERM) return 0;
#ifdef O_TMPFILE
  if (repository_read_profile && !repository_write_profile) {
    errno = 0;
    descriptor = openat(AT_FDCWD, ".",
                        O_TMPFILE | O_RDWR | O_CLOEXEC, 0600);
    if (descriptor >= 0) {
      (void)close(descriptor);
      return 0;
    }
    if (errno != EPERM) return 0;
  }
#endif
#ifdef SYS_clone3
  errno = 0;
  if (syscall(SYS_clone3, NULL, 0) != -1 || errno != EPERM) return 0;
#endif
#ifdef SYS_unshare
  errno = 0;
  if (syscall(SYS_unshare, CLONE_NEWUSER) != -1 || errno != EPERM) return 0;
#endif
  /* Pathname metadata and O_PATH handles must not become an escape hatch
     around the descriptor-bound Landlock policy. */
  errno = 0;
  descriptor = openat(AT_FDCWD, "/etc/passwd", O_PATH | O_CLOEXEC);
  if (descriptor >= 0) {
    (void)close(descriptor);
    return 0;
  }
  if (errno != EPERM) return 0;
#ifdef SYS_newfstatat
  if (!repository_read_profile) {
    errno = 0;
    if (syscall(SYS_newfstatat, AT_FDCWD, "/", &metadata, 0) != -1 ||
        errno != EPERM) {
      return 0;
    }
  }
#else
  (void)metadata;
#endif
  return 1;
}

static int safe_git_open_dev_null_v1(void) {
  struct stat metadata;
  int descriptor =
      open("/dev/null", O_RDONLY | O_NOCTTY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &metadata) != 0 ||
      !S_ISCHR(metadata.st_mode) || metadata.st_uid != 0 ||
      metadata.st_nlink == 0 || metadata.st_rdev != makedev(1, 3)) {
    if (descriptor >= 0) (void)close(descriptor);
    return -1;
  }
  return descriptor;
}

static void safe_git_child_report_failure_v1(int setup_fd) {
  const unsigned char failure = 1;
  ssize_t ignored;
  do {
    ignored = write(setup_fd, &failure, 1);
  } while (ignored < 0 && errno == EINTR);
  (void)ignored;
  _exit(127);
}

static int safe_git_duplicate_child_authority_fds_v1(
    int retained_executable_fd, int setup_write_fd,
    int retained_empty_hooks_directory_fd) {
  int temporary_executable = -1;
  int temporary_setup = -1;
  int temporary_empty_hooks = -1;
  temporary_executable =
      fcntl(retained_executable_fd, F_DUPFD_CLOEXEC, 250);
  if (temporary_executable < 250 || temporary_executable > 253) goto failure;
  temporary_setup =
      fcntl(setup_write_fd, F_DUPFD_CLOEXEC, temporary_executable + 1);
  if (temporary_setup <= temporary_executable || temporary_setup > 254) {
    goto failure;
  }
  if (retained_empty_hooks_directory_fd >= 0) {
    temporary_empty_hooks = fcntl(retained_empty_hooks_directory_fd,
                                  F_DUPFD_CLOEXEC, temporary_setup + 1);
    if (temporary_empty_hooks <= temporary_setup || temporary_empty_hooks > 255) {
      goto failure;
    }
  }
  if (
      dup3(temporary_executable, SAFE_GIT_RUNNER_EXEC_FD_V1, O_CLOEXEC) < 0 ||
      dup3(temporary_setup, SAFE_GIT_RUNNER_SETUP_FD_V1, O_CLOEXEC) < 0 ||
      (temporary_empty_hooks >= 0 &&
       dup3(temporary_empty_hooks, SAFE_GIT_RUNNER_EMPTY_HOOKS_FD_V1, 0) < 0)) {
    goto failure;
  }
  (void)close(temporary_executable);
  (void)close(temporary_setup);
  if (temporary_empty_hooks >= 0) (void)close(temporary_empty_hooks);
  return 1;

failure:
  if (temporary_executable >= 0) (void)close(temporary_executable);
  if (temporary_setup >= 0) (void)close(temporary_setup);
  if (temporary_empty_hooks >= 0) (void)close(temporary_empty_hooks);
  return 0;
}

static void safe_git_command_child_v1(
    pid_t expected_parent, int retained_executable_fd,
    char *const arguments[], char *const environment[], int working_directory_fd,
    int retained_empty_hooks_directory_fd, const int *read_authority_fds,
    size_t read_authority_count, int repository_read_profile,
    int repository_write_profile, int write_authority_fd, int dev_null_fd,
    int stdout_write_fd, int stderr_write_fd, int setup_write_fd,
    const struct safe_git_elf_closure_v1 *closure) {
  if (prctl(PR_SET_PDEATHSIG, SIGKILL, 0, 0, 0) != 0 ||
      getppid() != expected_parent || setsid() < 0 || raise(SIGSTOP) != 0 ||
      dup3(dev_null_fd, STDIN_FILENO, 0) < 0 ||
      dup3(stdout_write_fd, STDOUT_FILENO, 0) < 0 ||
      dup3(stderr_write_fd, STDERR_FILENO, 0) < 0 ||
      (working_directory_fd >= 0 ? fchdir(working_directory_fd) : chdir("/")) !=
          0 ||
      prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) != 0 ||
      !safe_git_install_landlock_v1(closure, dev_null_fd, read_authority_fds,
                                    read_authority_count, write_authority_fd) ||
      !safe_git_landlock_negative_write_test_v1()) {
    safe_git_child_report_failure_v1(setup_write_fd);
  }
  if (!safe_git_duplicate_child_authority_fds_v1(retained_executable_fd,
                                                  setup_write_fd,
                                                  retained_empty_hooks_directory_fd)) {
    safe_git_child_report_failure_v1(setup_write_fd);
  }
  if (!safe_git_install_resource_limits_v1(repository_write_profile) ||
      syscall(SYS_close_range, 3U,
              (unsigned int)(SAFE_GIT_RUNNER_EXEC_FD_V1 - 1), 0) != 0 ||
      syscall(SYS_close_range,
              (unsigned int)(retained_empty_hooks_directory_fd >= 0
                                 ? SAFE_GIT_RUNNER_EMPTY_HOOKS_FD_V1 + 1
                                 : SAFE_GIT_RUNNER_SETUP_FD_V1 + 1),
              UINT_MAX,
              0) != 0 ||
      !safe_git_install_seccomp_v1(SAFE_GIT_RUNNER_EXEC_FD_V1,
                                   repository_read_profile,
                                   repository_write_profile) ||
      !safe_git_seccomp_negative_tests_v1(repository_read_profile,
                                          repository_write_profile)) {
    safe_git_child_report_failure_v1(SAFE_GIT_RUNNER_SETUP_FD_V1);
  }

  (void)syscall(SYS_execveat, SAFE_GIT_RUNNER_EXEC_FD_V1, "", arguments,
                environment, AT_EMPTY_PATH);
  safe_git_child_report_failure_v1(SAFE_GIT_RUNNER_SETUP_FD_V1);
}

static int safe_git_make_pipe_v1(int pipe_descriptors[2]) {
  return pipe2(pipe_descriptors, O_CLOEXEC | O_NONBLOCK) == 0 &&
         pipe_descriptors[0] > STDERR_FILENO &&
         pipe_descriptors[1] > STDERR_FILENO;
}

static void safe_git_close_fd_v1(int *descriptor) {
  if (*descriptor >= 0) (void)close(*descriptor);
  *descriptor = -1;
}

static int safe_git_drain_stdout_v1(struct safe_git_supervisor_v1 *supervisor,
                                    int *limit_exceeded) {
  unsigned char buffer[4096];
  for (;;) {
    ssize_t amount = read(supervisor->stdout_fd, buffer, sizeof(buffer));
    if (amount < 0 && errno == EINTR) continue;
    if (amount < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return 1;
    if (amount < 0) return 0;
    if (amount == 0) {
      safe_git_close_fd_v1(&supervisor->stdout_fd);
      return 1;
    }
    if (supervisor->stdout_bytes == NULL ||
        supervisor->stdout_length > supervisor->stdout_capacity ||
        (size_t)amount >
            supervisor->stdout_capacity - supervisor->stdout_length) {
      *limit_exceeded = 1;
      safe_git_runner_secure_zero_v1(buffer, sizeof(buffer));
      return 1;
    }
    memcpy(supervisor->stdout_bytes + supervisor->stdout_length, buffer,
           (size_t)amount);
    supervisor->stdout_length += (size_t)amount;
  }
}

static int safe_git_drain_stderr_v1(struct safe_git_supervisor_v1 *supervisor,
                                    int *limit_exceeded) {
  unsigned char buffer[4096];
  for (;;) {
    ssize_t amount = read(supervisor->stderr_fd, buffer, sizeof(buffer));
    if (amount < 0 && errno == EINTR) continue;
    if (amount < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      safe_git_runner_secure_zero_v1(buffer, sizeof(buffer));
      return 1;
    }
    if (amount < 0) {
      safe_git_runner_secure_zero_v1(buffer, sizeof(buffer));
      return 0;
    }
    if (amount == 0) {
      safe_git_close_fd_v1(&supervisor->stderr_fd);
      safe_git_runner_secure_zero_v1(buffer, sizeof(buffer));
      return 1;
    }
    if ((size_t)amount >
        SAFE_GIT_RUNNER_STDERR_LIMIT_V1 - supervisor->stderr_length) {
      *limit_exceeded = 1;
      safe_git_runner_secure_zero_v1(buffer, sizeof(buffer));
      return 1;
    }
    supervisor->stderr_length += (size_t)amount;
    safe_git_runner_secure_zero_v1(buffer, (size_t)amount);
  }
}

static int safe_git_drain_setup_v1(struct safe_git_supervisor_v1 *supervisor) {
  unsigned char byte;
  for (;;) {
    ssize_t amount = read(supervisor->setup_fd, &byte, 1);
    if (amount < 0 && errno == EINTR) continue;
    if (amount < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) return 1;
    if (amount < 0) return 0;
    if (amount == 0) {
      safe_git_close_fd_v1(&supervisor->setup_fd);
      supervisor->setup_succeeded = 1;
      return 1;
    }
    /* Any byte is a stable setup/exec failure; its value is intentionally mute. */
    safe_git_close_fd_v1(&supervisor->setup_fd);
    supervisor->setup_succeeded = 0;
    return 1;
  }
}

static int safe_git_reap_child_v1(struct safe_git_supervisor_v1 *supervisor) {
  pid_t outcome;
  if (supervisor->child_reaped) return 1;
  do {
    outcome = waitpid(supervisor->child, &supervisor->child_status, WNOHANG);
  } while (outcome < 0 && errno == EINTR);
  if (outcome == supervisor->child) {
    supervisor->child_reaped = 1;
    return 1;
  }
  return outcome == 0;
}

static int safe_git_verify_child_containment_v1(
    struct safe_git_supervisor_v1 *supervisor,
    const struct safe_git_cgroup_v1 *cgroup, int64_t deadline) {
  for (;;) {
    int status = 0;
    pid_t outcome;
    int64_t now = safe_git_monotonic_now_ns_v1();
    if (now < 0 || now >= deadline) return 0;
    do {
      outcome = waitpid(supervisor->child, &status, WNOHANG | WUNTRACED);
    } while (outcome < 0 && errno == EINTR);
    if (outcome < 0) return 0;
    if (outcome == supervisor->child) {
      if (WIFSTOPPED(status) && WSTOPSIG(status) == SIGSTOP &&
          getpgid(supervisor->child) == supervisor->child &&
          safe_git_cgroup_has_exact_pid_v1(cgroup->payload_fd,
                                           supervisor->child) &&
          syscall(SYS_pidfd_send_signal, supervisor->pidfd, SIGCONT, NULL,
                  0) == 0) {
        supervisor->child_status = 0;
        return 1;
      }
      if (WIFEXITED(status) || WIFSIGNALED(status)) {
        supervisor->child_reaped = 1;
        supervisor->child_status = status;
      }
      return 0;
    }
    {
      struct timespec pause = {.tv_sec = 0, .tv_nsec = 1000000};
      while (nanosleep(&pause, &pause) != 0 && errno == EINTR) {
      }
    }
  }
}

static void safe_git_signal_payload_v1(struct safe_git_supervisor_v1 *supervisor,
                                       struct safe_git_cgroup_v1 *cgroup,
                                       int signal_number, int hard) {
  if (supervisor->child > 0) {
    (void)kill(-supervisor->child, signal_number);
#ifdef SYS_pidfd_send_signal
    if (supervisor->pidfd >= 0) {
      (void)syscall(SYS_pidfd_send_signal, supervisor->pidfd, signal_number,
                    NULL, 0);
    }
#endif
  }
  if (hard && cgroup->payload_fd >= 0) {
    (void)safe_git_write_exact_file_at_v1(cgroup->payload_fd, "cgroup.kill",
                                          "1");
  }
}

static void safe_git_poll_payload_once_v1(
    struct safe_git_supervisor_v1 *supervisor, int timeout_ms,
    int *stdout_limit, int *stderr_limit, int *io_valid) {
  struct pollfd descriptors[4];
  nfds_t count = 0;
  int outcome;
  if (supervisor->stdout_fd >= 0) {
    descriptors[count].fd = supervisor->stdout_fd;
    descriptors[count].events = POLLIN | POLLHUP | POLLERR;
    descriptors[count].revents = 0;
    count += 1;
  }
  if (supervisor->stderr_fd >= 0) {
    descriptors[count].fd = supervisor->stderr_fd;
    descriptors[count].events = POLLIN | POLLHUP | POLLERR;
    descriptors[count].revents = 0;
    count += 1;
  }
  if (supervisor->setup_fd >= 0) {
    descriptors[count].fd = supervisor->setup_fd;
    descriptors[count].events = POLLIN | POLLHUP | POLLERR;
    descriptors[count].revents = 0;
    count += 1;
  }
  if (supervisor->pidfd >= 0 && !supervisor->child_reaped) {
    descriptors[count].fd = supervisor->pidfd;
    descriptors[count].events = POLLIN | POLLHUP | POLLERR;
    descriptors[count].revents = 0;
    count += 1;
  }
  do {
    outcome = poll(descriptors, count, timeout_ms);
  } while (outcome < 0 && errno == EINTR);
  if (outcome < 0) {
    *io_valid = 0;
    return;
  }
  if (supervisor->stdout_fd >= 0 &&
      !safe_git_drain_stdout_v1(supervisor, stdout_limit)) {
    *io_valid = 0;
  }
  if (supervisor->stderr_fd >= 0 &&
      !safe_git_drain_stderr_v1(supervisor, stderr_limit)) {
    *io_valid = 0;
  }
  if (supervisor->setup_fd >= 0 &&
      !safe_git_drain_setup_v1(supervisor)) {
    *io_valid = 0;
  }
  if (!safe_git_reap_child_v1(supervisor)) *io_valid = 0;
}

static int safe_git_wait_after_signal_v1(
    struct safe_git_supervisor_v1 *supervisor,
    struct safe_git_cgroup_v1 *cgroup, int64_t grace_ns) {
  int64_t deadline = safe_git_monotonic_now_ns_v1();
  int stdout_limit = 0;
  int stderr_limit = 0;
  int io_valid = 1;
  if (deadline < 0 || deadline > INT64_MAX - grace_ns) return 0;
  deadline += grace_ns;
  while (!supervisor->child_reaped) {
    int64_t now = safe_git_monotonic_now_ns_v1();
    int timeout_ms;
    if (now < 0) return 0;
    if (now >= deadline) break;
    timeout_ms = (int)((deadline - now + 999999) / 1000000);
    if (timeout_ms > 20) timeout_ms = 20;
    safe_git_poll_payload_once_v1(supervisor, timeout_ms, &stdout_limit,
                                  &stderr_limit, &io_valid);
  }
  if (!supervisor->child_reaped) {
    safe_git_signal_payload_v1(supervisor, cgroup, SIGKILL, 1);
    deadline = safe_git_monotonic_now_ns_v1();
    if (deadline < 0 ||
        deadline > INT64_MAX - SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1) {
      return 0;
    }
    deadline += SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1;
    while (!supervisor->child_reaped) {
      int64_t now = safe_git_monotonic_now_ns_v1();
      if (now < 0 || now >= deadline) return 0;
      safe_git_poll_payload_once_v1(supervisor, 10, &stdout_limit,
                                    &stderr_limit, &io_valid);
    }
  }
  return io_valid;
}

static int safe_git_supervise_version_v1(
    struct safe_git_supervisor_v1 *supervisor,
    struct safe_git_cgroup_v1 *cgroup,
    enum safe_git_runner_status_v1 *status, int64_t deadline) {
  int stdout_limit = 0;
  int stderr_limit = 0;
  int io_valid = 1;
  for (;;) {
    int64_t now = safe_git_monotonic_now_ns_v1();
    int timeout_ms;
    if (now < 0) return 0;
    if (stdout_limit || stderr_limit || !io_valid ||
        (!supervisor->setup_succeeded && supervisor->setup_fd < 0)) {
      break;
    }
    if (supervisor->child_reaped && supervisor->stdout_fd < 0 &&
        supervisor->stderr_fd < 0 && supervisor->setup_fd < 0) {
      break;
    }
    if (now >= deadline) {
      *status = SAFE_GIT_RUNNER_STATUS_TIMEOUT_V1;
      break;
    }
    timeout_ms = (int)((deadline - now + 999999) / 1000000);
    if (timeout_ms > 50) timeout_ms = 50;
    safe_git_poll_payload_once_v1(supervisor, timeout_ms, &stdout_limit,
                                  &stderr_limit, &io_valid);
  }

  if (*status == SAFE_GIT_RUNNER_STATUS_TIMEOUT_V1 || stdout_limit ||
      stderr_limit || !io_valid || !supervisor->child_reaped) {
    if (*status != SAFE_GIT_RUNNER_STATUS_TIMEOUT_V1) {
      if (stdout_limit) {
        *status = SAFE_GIT_RUNNER_STATUS_STDOUT_LIMIT_V1;
      } else if (stderr_limit) {
        *status = SAFE_GIT_RUNNER_STATUS_STDERR_LIMIT_V1;
      } else {
        *status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
      }
    }
    safe_git_signal_payload_v1(supervisor, cgroup, SIGTERM, 0);
    if (!safe_git_wait_after_signal_v1(
            supervisor, cgroup, SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1)) {
      return 0;
    }
  }
  if (!supervisor->child_reaped) return 0;
  return 1;
}

static int safe_git_probe_required_linux_primitives_v1(void) {
  int landlock_abi;
  int pidfd;
  char *const arguments[] = {(char *)"", NULL};
  char *const environment[] = {NULL};
  landlock_abi = (int)syscall(SYS_landlock_create_ruleset, NULL, 0,
                              LANDLOCK_CREATE_RULESET_VERSION);
  if (landlock_abi < 4 || prctl(PR_GET_SECCOMP, 0, 0, 0, 0) < 0 ||
      syscall(SYS_close_range, UINT_MAX - 1U, UINT_MAX, 0) != 0) {
    return 0;
  }
  pidfd = (int)syscall(SYS_pidfd_open, getpid(), 0);
  if (pidfd < 0) return 0;
  (void)close(pidfd);
  errno = 0;
  if (syscall(SYS_execveat, -1, "", arguments, environment, AT_EMPTY_PATH) !=
          -1 ||
      errno != EBADF) {
    return 0;
  }
  return 1;
}

static int safe_git_validate_canonical_argv0_v1(const char *value) {
  size_t length = value == NULL ? 0 : strlen(value);
  size_t index;
  if (length < 2 || length > 4096 || value[0] != '/' ||
      value[length - 1] == '/' ||
      strstr(value, "//") != NULL || strstr(value, "/../") != NULL ||
      strstr(value, "/./") != NULL ||
      (length >= 2 && strcmp(value + length - 2, "/.") == 0) ||
      (length >= 3 && strcmp(value + length - 3, "/..") == 0)) {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    unsigned char byte = (unsigned char)value[index];
    if (byte < 0x20 || byte == 0x7f) return 0;
  }
  return 1;
}

int safe_git_run_linux_version_v1(
    int retained_executable_fd, const char *canonical_argv0,
    struct safe_git_runner_version_result_v1 *result) {
  struct safe_git_elf_closure_v1 closure;
  struct safe_git_cgroup_v1 cgroup;
  struct safe_git_supervisor_v1 supervisor;
  struct clone_args clone_arguments;
  int stdout_pipe[2] = {-1, -1};
  int stderr_pipe[2] = {-1, -1};
  int setup_pipe[2] = {-1, -1};
  int dev_null = -1;
  int resource_limited = 0;
  int cgroup_result_valid = 0;
  int containment_cleanup_valid = 0;
  int64_t execution_start;
  int64_t execution_deadline;
  pid_t parent = getpid();
  pid_t child;
  unsigned char stdout_bytes[SAFE_GIT_RUNNER_VERSION_STDOUT_LIMIT_V1];
  char *const arguments[] = {(char *)canonical_argv0, (char *)"--version", NULL};
  char *const environment[] = {
      (char *)"LC_ALL=C",
      (char *)"LANG=C",
      (char *)"GIT_CONFIG_NOSYSTEM=1",
      (char *)"GIT_CONFIG_SYSTEM=/dev/null",
      (char *)"GIT_CONFIG_GLOBAL=/dev/null",
      (char *)"GIT_OPTIONAL_LOCKS=0",
      (char *)"GIT_TERMINAL_PROMPT=0",
      (char *)"GIT_PAGER=",
      (char *)"GIT_NO_LAZY_FETCH=1",
      (char *)"GIT_NO_REPLACE_OBJECTS=1",
      NULL,
  };

  if (result == NULL || retained_executable_fd < 0 ||
      !safe_git_validate_canonical_argv0_v1(canonical_argv0)) {
    return 0;
  }
  memset(result, 0, sizeof(*result));
  result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  memset(&closure, 0, sizeof(closure));
  memset(&cgroup, 0, sizeof(cgroup));
  cgroup.parent_fd = -1;
  cgroup.payload_fd = -1;
  memset(&supervisor, 0, sizeof(supervisor));
  supervisor.child = -1;
  supervisor.pidfd = -1;
  supervisor.stdout_fd = -1;
  supervisor.stderr_fd = -1;
  supervisor.setup_fd = -1;
  memset(stdout_bytes, 0, sizeof(stdout_bytes));
  supervisor.stdout_bytes = stdout_bytes;
  supervisor.stdout_capacity = sizeof(stdout_bytes);
  memset(&clone_arguments, 0, sizeof(clone_arguments));

  if (!safe_git_probe_required_linux_primitives_v1() ||
      !safe_git_open_elf_closure_v1(retained_executable_fd, &closure) ||
      !safe_git_prepare_cgroup_v1(&cgroup) ||
      (dev_null = safe_git_open_dev_null_v1()) < 0 ||
      !safe_git_make_pipe_v1(stdout_pipe) ||
      !safe_git_make_pipe_v1(stderr_pipe) ||
      !safe_git_make_pipe_v1(setup_pipe)) {
    goto cleanup;
  }

  clone_arguments.flags = CLONE_PIDFD | CLONE_INTO_CGROUP;
  clone_arguments.pidfd = (uint64_t)(uintptr_t)&supervisor.pidfd;
  clone_arguments.exit_signal = SIGCHLD;
  clone_arguments.cgroup = (uint64_t)cgroup.payload_fd;
  execution_start = safe_git_monotonic_now_ns_v1();
  if (execution_start < 0 ||
      execution_start > INT64_MAX - SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1) {
    goto cleanup;
  }
  execution_deadline = execution_start + SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1;
  child = (pid_t)syscall(SYS_clone3, &clone_arguments,
                         sizeof(clone_arguments));
  if (child < 0) goto cleanup;
  if (child == 0) {
    (void)close(stdout_pipe[0]);
    (void)close(stderr_pipe[0]);
    (void)close(setup_pipe[0]);
    safe_git_command_child_v1(
        parent, retained_executable_fd, arguments, environment, -1, -1, NULL,
        0, 0, 0, -1, dev_null, stdout_pipe[1], stderr_pipe[1], setup_pipe[1],
        &closure);
  }

  supervisor.child = child;
  if (!safe_git_verify_child_containment_v1(&supervisor, &cgroup,
                                             execution_deadline)) {
    goto cleanup;
  }
  supervisor.stdout_fd = stdout_pipe[0];
  stdout_pipe[0] = -1;
  supervisor.stderr_fd = stderr_pipe[0];
  stderr_pipe[0] = -1;
  supervisor.setup_fd = setup_pipe[0];
  setup_pipe[0] = -1;
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);

  result->status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
  if (!safe_git_supervise_version_v1(&supervisor, &cgroup, &result->status,
                                     execution_deadline)) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  cgroup_result_valid = safe_git_cgroup_resource_result_v1(
      cgroup.payload_fd, &resource_limited);
  if (!cgroup_result_valid) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (resource_limited) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  } else if (!supervisor.setup_succeeded) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             supervisor.setup_succeeded &&
             WIFEXITED(supervisor.child_status) &&
             WEXITSTATUS(supervisor.child_status) == 0) {
    result->status = SAFE_GIT_RUNNER_STATUS_OK_V1;
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             WIFSIGNALED(supervisor.child_status) &&
             WTERMSIG(supervisor.child_status) == SIGXCPU) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  }

cleanup:
  if (supervisor.child > 0 && !supervisor.child_reaped) {
    safe_git_signal_payload_v1(&supervisor, &cgroup, SIGTERM, 0);
    (void)safe_git_wait_after_signal_v1(
        &supervisor, &cgroup, SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1);
    /* Returning control to the authority-bearing Node process while a
     * payload is still live would abandon the pidfd/cgroup kill authority.
     * If SIGKILL+cgroup.kill cannot establish both reap and an empty cgroup,
     * fail-stop the service and let the service manager restart it. */
    safe_git_fail_stop_if_cleanup_incomplete_v1(&supervisor, &cgroup);
  }
  safe_git_close_fd_v1(&supervisor.stdout_fd);
  safe_git_close_fd_v1(&supervisor.stderr_fd);
  safe_git_close_fd_v1(&supervisor.setup_fd);
  safe_git_close_fd_v1(&supervisor.pidfd);
  safe_git_close_fd_v1(&stdout_pipe[0]);
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[0]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[0]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);
  containment_cleanup_valid = safe_git_close_cgroup_v1(&cgroup);
  if (!containment_cleanup_valid &&
      result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  if (result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
    result->stdout_length = supervisor.stdout_length;
    memcpy(result->stdout_bytes, stdout_bytes, supervisor.stdout_length);
  } else {
    result->stdout_length = 0;
    memset(result->stdout_bytes, 0, sizeof(result->stdout_bytes));
  }
  safe_git_runner_secure_zero_v1(stdout_bytes, sizeof(stdout_bytes));
  safe_git_runner_secure_zero_v1(&supervisor, sizeof(supervisor));
  safe_git_runner_secure_zero_v1(&clone_arguments, sizeof(clone_arguments));
  return 1;
}

struct safe_git_read_argv_v1 {
  char *arguments[32];
  char derived_one[SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 + 16];
  char derived_two[132];
};

static int safe_git_read_oid_is_valid_v1(const char *value) {
  size_t length = value == NULL ? 0 : strlen(value);
  size_t index;
  if (length != 40 && length != 64) return 0;
  for (index = 0; index < length; index += 1) {
    unsigned char byte = (unsigned char)value[index];
    if (!((byte >= (unsigned char)'0' && byte <= (unsigned char)'9') ||
          (byte >= (unsigned char)'a' && byte <= (unsigned char)'f'))) {
      return 0;
    }
  }
  return 1;
}

static int safe_git_read_revision_is_valid_v1(const char *value) {
  size_t length = value == NULL
                      ? 0
                      : strnlen(value,
                                SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 + 1);
  size_t index;
  if (length == 0 || length > SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 ||
      value[0] == '-') {
    return 0;
  }
  for (index = 0; index < length; index += 1) {
    unsigned char byte = (unsigned char)value[index];
    if (byte < 0x20U || byte == 0x7fU) return 0;
  }
  return 1;
}

static size_t safe_git_read_output_limit_v1(
    enum safe_git_runner_read_profile_v1 profile) {
  switch (profile) {
    case SAFE_GIT_RUNNER_READ_REV_PARSE_SHOW_TOPLEVEL_V1:
    case SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_GIT_DIR_V1:
    case SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_COMMON_GIT_DIR_V1:
    case SAFE_GIT_RUNNER_READ_SYMBOLIC_HEAD_V1:
    case SAFE_GIT_RUNNER_READ_CONFIG_GLOBAL_EXCLUDES_FILE_V1:
      return 4096;
    case SAFE_GIT_RUNNER_READ_REV_PARSE_HEAD_COMMIT_V1:
    case SAFE_GIT_RUNNER_READ_REV_PARSE_BASELINE_COMMIT_V1:
    case SAFE_GIT_RUNNER_READ_MERGE_BASE_V1:
    case SAFE_GIT_RUNNER_READ_REV_LIST_AHEAD_BEHIND_V1:
    case SAFE_GIT_RUNNER_READ_CAT_FILE_TYPE_V1:
      return 128;
    case SAFE_GIT_RUNNER_READ_STATUS_PORCELAIN_V2_V1:
    case SAFE_GIT_RUNNER_READ_LS_FILES_STAGE_V1:
    case SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1:
    case SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1:
    case SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1:
    case SAFE_GIT_RUNNER_READ_LS_IGNORE_FILES_V1:
      return SAFE_GIT_RUNNER_READ_STDOUT_LIMIT_V1;
    default:
      return 0;
  }
}

static int safe_git_read_push_argument_v1(struct safe_git_read_argv_v1 *argv,
                                          size_t *count, char *value) {
  if (*count + 1 >= sizeof(argv->arguments) / sizeof(argv->arguments[0])) {
    return 0;
  }
  argv->arguments[(*count)++] = value;
  argv->arguments[*count] = NULL;
  return 1;
}

static int safe_git_build_read_argv_v1(
    const char *canonical_argv0,
    const struct safe_git_runner_read_request_v1 *request,
    struct safe_git_read_argv_v1 *argv) {
  size_t count = 0;
  int formatted;
#define SAFE_GIT_READ_ARG_V1(value)                                            \
  do {                                                                         \
    if (!safe_git_read_push_argument_v1(argv, &count, (char *)(value)))        \
      return 0;                                                                \
  } while (0)
  memset(argv, 0, sizeof(*argv));
  if (request == NULL || request->parameter_one[
                             SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1] != '\0' ||
      request->parameter_two[64] != '\0') {
    return 0;
  }
  SAFE_GIT_READ_ARG_V1(canonical_argv0);
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("core.hooksPath=/proc/self/fd/202");
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("core.fsmonitor=false");
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("core.untrackedCache=false");
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("diff.external=");
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("protocol.allow=never");
  SAFE_GIT_READ_ARG_V1("-c");
  SAFE_GIT_READ_ARG_V1("submodule.recurse=false");

  switch (request->profile) {
    case SAFE_GIT_RUNNER_READ_REV_PARSE_SHOW_TOPLEVEL_V1:
      SAFE_GIT_READ_ARG_V1("rev-parse");
      SAFE_GIT_READ_ARG_V1("--show-toplevel");
      break;
    case SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_GIT_DIR_V1:
      SAFE_GIT_READ_ARG_V1("rev-parse");
      SAFE_GIT_READ_ARG_V1("--absolute-git-dir");
      break;
    case SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_COMMON_GIT_DIR_V1:
      SAFE_GIT_READ_ARG_V1("rev-parse");
      SAFE_GIT_READ_ARG_V1("--path-format=absolute");
      SAFE_GIT_READ_ARG_V1("--git-common-dir");
      break;
    case SAFE_GIT_RUNNER_READ_STATUS_PORCELAIN_V2_V1:
      SAFE_GIT_READ_ARG_V1("status");
      SAFE_GIT_READ_ARG_V1("--porcelain=v2");
      SAFE_GIT_READ_ARG_V1("--branch");
      SAFE_GIT_READ_ARG_V1("-z");
      SAFE_GIT_READ_ARG_V1("--untracked-files=all");
      SAFE_GIT_READ_ARG_V1("--ignore-submodules=none");
      break;
    case SAFE_GIT_RUNNER_READ_REV_PARSE_HEAD_COMMIT_V1:
      SAFE_GIT_READ_ARG_V1("rev-parse");
      SAFE_GIT_READ_ARG_V1("--verify");
      SAFE_GIT_READ_ARG_V1("HEAD^{commit}");
      break;
    case SAFE_GIT_RUNNER_READ_SYMBOLIC_HEAD_V1:
      SAFE_GIT_READ_ARG_V1("symbolic-ref");
      SAFE_GIT_READ_ARG_V1("--quiet");
      SAFE_GIT_READ_ARG_V1("--short");
      SAFE_GIT_READ_ARG_V1("HEAD");
      break;
    case SAFE_GIT_RUNNER_READ_LS_FILES_STAGE_V1:
      SAFE_GIT_READ_ARG_V1("ls-files");
      SAFE_GIT_READ_ARG_V1("--stage");
      SAFE_GIT_READ_ARG_V1("-z");
      break;
    case SAFE_GIT_RUNNER_READ_REV_PARSE_BASELINE_COMMIT_V1:
      formatted = snprintf(argv->derived_one, sizeof(argv->derived_one),
                           "%s^{commit}", request->parameter_one);
      if (!safe_git_read_revision_is_valid_v1(request->parameter_one) ||
          formatted <= 0 || (size_t)formatted >= sizeof(argv->derived_one)) {
        return 0;
      }
      SAFE_GIT_READ_ARG_V1("rev-parse");
      SAFE_GIT_READ_ARG_V1("--verify");
      SAFE_GIT_READ_ARG_V1("--end-of-options");
      SAFE_GIT_READ_ARG_V1(argv->derived_one);
      break;
    case SAFE_GIT_RUNNER_READ_MERGE_BASE_V1:
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one) ||
          !safe_git_read_oid_is_valid_v1(request->parameter_two)) {
        return 0;
      }
      SAFE_GIT_READ_ARG_V1("merge-base");
      SAFE_GIT_READ_ARG_V1(request->parameter_one);
      SAFE_GIT_READ_ARG_V1(request->parameter_two);
      break;
    case SAFE_GIT_RUNNER_READ_REV_LIST_AHEAD_BEHIND_V1:
      formatted = snprintf(argv->derived_two, sizeof(argv->derived_two),
                           "%s...%s", request->parameter_one,
                           request->parameter_two);
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one) ||
          !safe_git_read_oid_is_valid_v1(request->parameter_two) ||
          formatted <= 0 || (size_t)formatted >= sizeof(argv->derived_two)) {
        return 0;
      }
      SAFE_GIT_READ_ARG_V1("rev-list");
      SAFE_GIT_READ_ARG_V1("--left-right");
      SAFE_GIT_READ_ARG_V1("--count");
      SAFE_GIT_READ_ARG_V1(argv->derived_two);
      break;
    case SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1:
      formatted = snprintf(argv->derived_two, sizeof(argv->derived_two),
                           "%s..%s", request->parameter_one,
                           request->parameter_two);
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one) ||
          !safe_git_read_oid_is_valid_v1(request->parameter_two) ||
          formatted <= 0 || (size_t)formatted >= sizeof(argv->derived_two)) {
        return 0;
      }
      SAFE_GIT_READ_ARG_V1("diff");
      SAFE_GIT_READ_ARG_V1("--no-ext-diff");
      SAFE_GIT_READ_ARG_V1("--no-textconv");
      SAFE_GIT_READ_ARG_V1("--name-status");
      SAFE_GIT_READ_ARG_V1("-z");
      SAFE_GIT_READ_ARG_V1("--no-renames");
      SAFE_GIT_READ_ARG_V1(argv->derived_two);
      SAFE_GIT_READ_ARG_V1("--");
      break;
    case SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1:
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one)) return 0;
      SAFE_GIT_READ_ARG_V1("diff");
      SAFE_GIT_READ_ARG_V1("--cached");
      SAFE_GIT_READ_ARG_V1("--no-ext-diff");
      SAFE_GIT_READ_ARG_V1("--no-textconv");
      SAFE_GIT_READ_ARG_V1("--name-status");
      SAFE_GIT_READ_ARG_V1("-z");
      SAFE_GIT_READ_ARG_V1("--no-renames");
      SAFE_GIT_READ_ARG_V1(request->parameter_one);
      SAFE_GIT_READ_ARG_V1("--");
      break;
    case SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1:
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one)) return 0;
      SAFE_GIT_READ_ARG_V1("cat-file");
      SAFE_GIT_READ_ARG_V1("-p");
      SAFE_GIT_READ_ARG_V1(request->parameter_one);
      break;
    case SAFE_GIT_RUNNER_READ_CAT_FILE_TYPE_V1:
      if (!safe_git_read_oid_is_valid_v1(request->parameter_one)) return 0;
      SAFE_GIT_READ_ARG_V1("cat-file");
      SAFE_GIT_READ_ARG_V1("-t");
      SAFE_GIT_READ_ARG_V1("--");
      SAFE_GIT_READ_ARG_V1(request->parameter_one);
      break;
    case SAFE_GIT_RUNNER_READ_LS_IGNORE_FILES_V1:
      SAFE_GIT_READ_ARG_V1("ls-files");
      SAFE_GIT_READ_ARG_V1("--cached");
      SAFE_GIT_READ_ARG_V1("--others");
      SAFE_GIT_READ_ARG_V1("--exclude-standard");
      SAFE_GIT_READ_ARG_V1("-z");
      SAFE_GIT_READ_ARG_V1("--");
      SAFE_GIT_READ_ARG_V1(".gitignore");
      SAFE_GIT_READ_ARG_V1(":(glob)**/.gitignore");
      break;
    case SAFE_GIT_RUNNER_READ_CONFIG_GLOBAL_EXCLUDES_FILE_V1:
      SAFE_GIT_READ_ARG_V1("config");
      SAFE_GIT_READ_ARG_V1("--path");
      SAFE_GIT_READ_ARG_V1("--get");
      SAFE_GIT_READ_ARG_V1("core.excludesfile");
      break;
    default:
      return 0;
  }
#undef SAFE_GIT_READ_ARG_V1
  return count > 1 && argv->arguments[count] == NULL;
}

static int safe_git_read_output_shape_is_valid_v1(
    enum safe_git_runner_read_profile_v1 profile, const unsigned char *bytes,
    size_t length, int exit_code) {
  size_t index;
  if (exit_code != 0 && length == 0) return 1;
  if (bytes == NULL) return 0;
  switch (profile) {
    case SAFE_GIT_RUNNER_READ_STATUS_PORCELAIN_V2_V1:
    case SAFE_GIT_RUNNER_READ_LS_FILES_STAGE_V1:
    case SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1:
    case SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1:
    case SAFE_GIT_RUNNER_READ_LS_IGNORE_FILES_V1:
      return length == 0 || bytes[length - 1] == 0;
    case SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1:
      return 1;
    case SAFE_GIT_RUNNER_READ_CAT_FILE_TYPE_V1:
      return (length == 5 &&
              (memcmp(bytes, "blob\n", 5) == 0 ||
               memcmp(bytes, "tree\n", 5) == 0)) ||
             (length == 7 && memcmp(bytes, "commit\n", 7) == 0) ||
             (length == 4 && memcmp(bytes, "tag\n", 4) == 0);
    default:
      for (index = 0; index < length; index += 1) {
        if (bytes[index] == 0 || bytes[index] == '\r') return 0;
      }
      return length == 0 || bytes[length - 1] == '\n';
  }
}

static int safe_git_read_directory_fd_is_valid_v1(int descriptor) {
  struct stat metadata;
  return descriptor >= 0 && fstat(descriptor, &metadata) == 0 &&
         S_ISDIR(metadata.st_mode);
}

void safe_git_release_linux_read_result_v1(
    struct safe_git_runner_read_result_v1 *result) {
  if (result == NULL) return;
  if (result->stdout_bytes != NULL) {
    safe_git_runner_secure_zero_v1(result->stdout_bytes,
                                   result->stdout_capacity);
    free(result->stdout_bytes);
  }
  memset(result, 0, sizeof(*result));
  result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  result->exit_code = -1;
}

int safe_git_run_linux_read_v1(
    int retained_executable_fd, const char *canonical_argv0,
    int retained_workspace_root_fd, int retained_git_directory_fd,
    int retained_common_directory_fd, int retained_empty_hooks_directory_fd,
    const struct safe_git_runner_read_request_v1 *request,
    struct safe_git_runner_read_result_v1 *result) {
  struct safe_git_read_argv_v1 argv;
  struct safe_git_elf_closure_v1 closure;
  struct safe_git_cgroup_v1 cgroup;
  struct safe_git_supervisor_v1 supervisor;
  struct clone_args clone_arguments;
  int stdout_pipe[2] = {-1, -1};
  int stderr_pipe[2] = {-1, -1};
  int setup_pipe[2] = {-1, -1};
  int read_authority_fds[4];
  int dev_null = -1;
  int resource_limited = 0;
  int cgroup_result_valid = 0;
  int containment_cleanup_valid = 0;
  int64_t execution_start;
  int64_t execution_deadline;
  pid_t parent = getpid();
  pid_t child;
  size_t output_limit;
  size_t profile_output_limit;
  char *const environment[] = {
      (char *)"LC_ALL=C",
      (char *)"LANG=C",
      (char *)"GIT_CONFIG_NOSYSTEM=1",
      (char *)"GIT_CONFIG_SYSTEM=/dev/null",
      (char *)"GIT_CONFIG_GLOBAL=/dev/null",
      (char *)"GIT_OPTIONAL_LOCKS=0",
      (char *)"GIT_TERMINAL_PROMPT=0",
      (char *)"GIT_PAGER=",
      (char *)"GIT_NO_LAZY_FETCH=1",
      (char *)"GIT_NO_REPLACE_OBJECTS=1",
      (char *)"GIT_ATTR_NOSYSTEM=1",
      (char *)"GIT_EXTERNAL_DIFF=",
      (char *)"GIT_PROTOCOL_FROM_USER=0",
      NULL,
  };

  if (result == NULL || request == NULL || retained_executable_fd < 0 ||
      !safe_git_validate_canonical_argv0_v1(canonical_argv0) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_workspace_root_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_git_directory_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_common_directory_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(
          retained_empty_hooks_directory_fd) ||
      (profile_output_limit =
           safe_git_read_output_limit_v1(request->profile)) == 0 ||
      request->stdout_limit == 0 ||
      request->stdout_limit > profile_output_limit ||
      !safe_git_build_read_argv_v1(canonical_argv0, request, &argv)) {
    return 0;
  }
  output_limit = request->stdout_limit;
  memset(result, 0, sizeof(*result));
  result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  result->exit_code = -1;
  result->stdout_bytes = (unsigned char *)malloc(output_limit);
  if (result->stdout_bytes == NULL) return 1;
  result->stdout_capacity = output_limit;
  memset(result->stdout_bytes, 0, output_limit);
  memset(&closure, 0, sizeof(closure));
  memset(&cgroup, 0, sizeof(cgroup));
  cgroup.parent_fd = -1;
  cgroup.payload_fd = -1;
  memset(&supervisor, 0, sizeof(supervisor));
  supervisor.child = -1;
  supervisor.pidfd = -1;
  supervisor.stdout_fd = -1;
  supervisor.stderr_fd = -1;
  supervisor.setup_fd = -1;
  supervisor.stdout_bytes = result->stdout_bytes;
  supervisor.stdout_capacity = output_limit;
  memset(&clone_arguments, 0, sizeof(clone_arguments));
  read_authority_fds[0] = retained_workspace_root_fd;
  read_authority_fds[1] = retained_git_directory_fd;
  read_authority_fds[2] = retained_common_directory_fd;
  read_authority_fds[3] = retained_empty_hooks_directory_fd;

  if (!safe_git_probe_required_linux_primitives_v1() ||
      !safe_git_open_elf_closure_v1(retained_executable_fd, &closure) ||
      !safe_git_prepare_cgroup_v1(&cgroup) ||
      (dev_null = safe_git_open_dev_null_v1()) < 0 ||
      !safe_git_make_pipe_v1(stdout_pipe) ||
      !safe_git_make_pipe_v1(stderr_pipe) ||
      !safe_git_make_pipe_v1(setup_pipe)) {
    goto cleanup;
  }

  clone_arguments.flags = CLONE_PIDFD | CLONE_INTO_CGROUP;
  clone_arguments.pidfd = (uint64_t)(uintptr_t)&supervisor.pidfd;
  clone_arguments.exit_signal = SIGCHLD;
  clone_arguments.cgroup = (uint64_t)cgroup.payload_fd;
  execution_start = safe_git_monotonic_now_ns_v1();
  if (execution_start < 0 ||
      execution_start > INT64_MAX - SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1) {
    goto cleanup;
  }
  execution_deadline = execution_start + SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1;
  child = (pid_t)syscall(SYS_clone3, &clone_arguments,
                         sizeof(clone_arguments));
  if (child < 0) goto cleanup;
  if (child == 0) {
    (void)close(stdout_pipe[0]);
    (void)close(stderr_pipe[0]);
    (void)close(setup_pipe[0]);
    safe_git_command_child_v1(
        parent, retained_executable_fd, argv.arguments, environment,
        retained_workspace_root_fd, retained_empty_hooks_directory_fd,
        read_authority_fds,
        sizeof(read_authority_fds) / sizeof(read_authority_fds[0]), 1, 0, -1,
        dev_null, stdout_pipe[1], stderr_pipe[1], setup_pipe[1], &closure);
  }

  supervisor.child = child;
  if (!safe_git_verify_child_containment_v1(&supervisor, &cgroup,
                                             execution_deadline)) {
    goto cleanup;
  }
  supervisor.stdout_fd = stdout_pipe[0];
  stdout_pipe[0] = -1;
  supervisor.stderr_fd = stderr_pipe[0];
  stderr_pipe[0] = -1;
  supervisor.setup_fd = setup_pipe[0];
  setup_pipe[0] = -1;
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);

  result->status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
  if (!safe_git_supervise_version_v1(&supervisor, &cgroup, &result->status,
                                     execution_deadline)) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  cgroup_result_valid = safe_git_cgroup_resource_result_v1(
      cgroup.payload_fd, &resource_limited);
  if (!cgroup_result_valid) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (resource_limited) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  } else if (!supervisor.setup_succeeded) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             WIFEXITED(supervisor.child_status)) {
    result->status = SAFE_GIT_RUNNER_STATUS_OK_V1;
    result->exit_code = WEXITSTATUS(supervisor.child_status);
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             WIFSIGNALED(supervisor.child_status) &&
             WTERMSIG(supervisor.child_status) == SIGXCPU) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  }

cleanup:
  if (supervisor.child > 0 && !supervisor.child_reaped) {
    safe_git_signal_payload_v1(&supervisor, &cgroup, SIGTERM, 0);
    (void)safe_git_wait_after_signal_v1(
        &supervisor, &cgroup, SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1);
    safe_git_fail_stop_if_cleanup_incomplete_v1(&supervisor, &cgroup);
  }
  safe_git_close_fd_v1(&supervisor.stdout_fd);
  safe_git_close_fd_v1(&supervisor.stderr_fd);
  safe_git_close_fd_v1(&supervisor.setup_fd);
  safe_git_close_fd_v1(&supervisor.pidfd);
  safe_git_close_fd_v1(&stdout_pipe[0]);
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[0]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[0]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);
  containment_cleanup_valid = safe_git_close_cgroup_v1(&cgroup);
  if (!containment_cleanup_valid &&
      result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  if (result->status == SAFE_GIT_RUNNER_STATUS_OK_V1 &&
      supervisor.stderr_length == 0 &&
      safe_git_read_output_shape_is_valid_v1(
          request->profile, result->stdout_bytes, supervisor.stdout_length,
          result->exit_code)) {
    result->stdout_length = supervisor.stdout_length;
  } else {
    result->stdout_length = 0;
    result->exit_code = -1;
    if (result->stdout_bytes != NULL) {
      safe_git_runner_secure_zero_v1(result->stdout_bytes, output_limit);
    }
    if (result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
      result->status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
    }
  }
  safe_git_runner_secure_zero_v1(&argv, sizeof(argv));
  safe_git_runner_secure_zero_v1(&supervisor, sizeof(supervisor));
  safe_git_runner_secure_zero_v1(&clone_arguments, sizeof(clone_arguments));
  return 1;
}

int safe_git_run_linux_create_lease_v1(
    int retained_executable_fd, const char *canonical_argv0,
    int retained_workspace_root_fd, int retained_git_directory_fd,
    int retained_common_directory_fd, int retained_empty_hooks_directory_fd,
    int retained_lease_namespace_fd,
    const struct safe_git_runner_lease_request_v1 *request,
    struct safe_git_runner_lease_result_v1 *result) {
  struct safe_git_elf_closure_v1 closure;
  struct safe_git_cgroup_v1 cgroup;
  struct safe_git_supervisor_v1 supervisor;
  struct clone_args clone_arguments;
  int stdout_pipe[2] = {-1, -1};
  int stderr_pipe[2] = {-1, -1};
  int setup_pipe[2] = {-1, -1};
  int read_authority_fds[4];
  int dev_null = -1;
  int resource_limited = 0;
  int cgroup_result_valid = 0;
  int containment_cleanup_valid = 0;
  int64_t execution_start;
  int64_t execution_deadline;
  pid_t parent = getpid();
  pid_t child;
  unsigned char stdout_byte = 0;
  char *arguments[20];
  char *const environment[] = {
      (char *)"LC_ALL=C",
      (char *)"LANG=C",
      (char *)"GIT_CONFIG_NOSYSTEM=1",
      (char *)"GIT_CONFIG_SYSTEM=/dev/null",
      (char *)"GIT_CONFIG_GLOBAL=/dev/null",
      (char *)"GIT_OPTIONAL_LOCKS=0",
      (char *)"GIT_TERMINAL_PROMPT=0",
      (char *)"GIT_PAGER=",
      (char *)"GIT_NO_LAZY_FETCH=1",
      (char *)"GIT_NO_REPLACE_OBJECTS=1",
      (char *)"GIT_ATTR_NOSYSTEM=1",
      (char *)"GIT_EXTERNAL_DIFF=",
      (char *)"GIT_PROTOCOL_FROM_USER=0",
      NULL,
  };

  if (result == NULL || request == NULL || retained_executable_fd < 0 ||
      !safe_git_validate_canonical_argv0_v1(canonical_argv0) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_workspace_root_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_git_directory_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_common_directory_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(
          retained_empty_hooks_directory_fd) ||
      !safe_git_read_directory_fd_is_valid_v1(retained_lease_namespace_fd) ||
      (request->delete_ref != 0 && request->delete_ref != 1) ||
      !safe_git_read_revision_is_valid_v1(request->ref_name) ||
      strncmp(request->ref_name,
              "refs/understand-code/task-baselines/", 36) != 0 ||
      !safe_git_read_oid_is_valid_v1(request->object_id) ||
      strlen(request->zero_object_id) != strlen(request->object_id) ||
      strspn(request->zero_object_id, "0") != strlen(request->zero_object_id)) {
    return 0;
  }
  memset(result, 0, sizeof(*result));
  result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  result->exit_code = -1;
  memset(&closure, 0, sizeof(closure));
  memset(&cgroup, 0, sizeof(cgroup));
  cgroup.parent_fd = -1;
  cgroup.payload_fd = -1;
  memset(&supervisor, 0, sizeof(supervisor));
  supervisor.child = -1;
  supervisor.pidfd = -1;
  supervisor.stdout_fd = -1;
  supervisor.stderr_fd = -1;
  supervisor.setup_fd = -1;
  supervisor.stdout_bytes = &stdout_byte;
  supervisor.stdout_capacity = 1;
  memset(&clone_arguments, 0, sizeof(clone_arguments));
  memset(arguments, 0, sizeof(arguments));
  arguments[0] = (char *)canonical_argv0;
  arguments[1] = (char *)"-c";
  arguments[2] = (char *)"core.hooksPath=/proc/self/fd/202";
  arguments[3] = (char *)"-c";
  arguments[4] = (char *)"core.logAllRefUpdates=false";
  arguments[5] = (char *)"-c";
  arguments[6] = (char *)"core.fsmonitor=false";
  arguments[7] = (char *)"-c";
  arguments[8] = (char *)"core.untrackedCache=false";
  arguments[9] = (char *)"-c";
  arguments[10] = (char *)"diff.external=";
  arguments[11] = (char *)"-c";
  arguments[12] = (char *)"protocol.allow=never";
  arguments[13] = (char *)"update-ref";
  arguments[14] = (char *)"--no-deref";
  if (request->delete_ref) {
    arguments[15] = (char *)"-d";
    arguments[16] = (char *)request->ref_name;
    arguments[17] = (char *)request->object_id;
    arguments[18] = NULL;
  } else {
    arguments[15] = (char *)request->ref_name;
    arguments[16] = (char *)request->object_id;
    arguments[17] = (char *)request->zero_object_id;
    arguments[18] = NULL;
  }
  read_authority_fds[0] = retained_workspace_root_fd;
  read_authority_fds[1] = retained_git_directory_fd;
  read_authority_fds[2] = retained_common_directory_fd;
  read_authority_fds[3] = retained_empty_hooks_directory_fd;

  if (!safe_git_probe_required_linux_primitives_v1() ||
      !safe_git_open_elf_closure_v1(retained_executable_fd, &closure) ||
      !safe_git_prepare_cgroup_v1(&cgroup) ||
      (dev_null = safe_git_open_dev_null_v1()) < 0 ||
      !safe_git_make_pipe_v1(stdout_pipe) ||
      !safe_git_make_pipe_v1(stderr_pipe) ||
      !safe_git_make_pipe_v1(setup_pipe)) {
    goto cleanup;
  }
  clone_arguments.flags = CLONE_PIDFD | CLONE_INTO_CGROUP;
  clone_arguments.pidfd = (uint64_t)(uintptr_t)&supervisor.pidfd;
  clone_arguments.exit_signal = SIGCHLD;
  clone_arguments.cgroup = (uint64_t)cgroup.payload_fd;
  execution_start = safe_git_monotonic_now_ns_v1();
  if (execution_start < 0 ||
      execution_start > INT64_MAX - SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1) {
    goto cleanup;
  }
  execution_deadline = execution_start + SAFE_GIT_RUNNER_WALL_TIMEOUT_NS_V1;
  child = (pid_t)syscall(SYS_clone3, &clone_arguments,
                         sizeof(clone_arguments));
  if (child < 0) goto cleanup;
  if (child == 0) {
    (void)close(stdout_pipe[0]);
    (void)close(stderr_pipe[0]);
    (void)close(setup_pipe[0]);
    safe_git_command_child_v1(
        parent, retained_executable_fd, arguments, environment,
        retained_workspace_root_fd, retained_empty_hooks_directory_fd,
        read_authority_fds,
        sizeof(read_authority_fds) / sizeof(read_authority_fds[0]), 1, 1,
        retained_lease_namespace_fd, dev_null, stdout_pipe[1], stderr_pipe[1],
        setup_pipe[1], &closure);
  }
  supervisor.child = child;
  if (!safe_git_verify_child_containment_v1(&supervisor, &cgroup,
                                             execution_deadline)) {
    goto cleanup;
  }
  supervisor.stdout_fd = stdout_pipe[0];
  stdout_pipe[0] = -1;
  supervisor.stderr_fd = stderr_pipe[0];
  stderr_pipe[0] = -1;
  supervisor.setup_fd = setup_pipe[0];
  setup_pipe[0] = -1;
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);
  result->status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
  if (!safe_git_supervise_version_v1(&supervisor, &cgroup, &result->status,
                                     execution_deadline)) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  cgroup_result_valid = safe_git_cgroup_resource_result_v1(
      cgroup.payload_fd, &resource_limited);
  if (!cgroup_result_valid) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (resource_limited) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  } else if (!supervisor.setup_succeeded) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             WIFEXITED(supervisor.child_status)) {
    result->status = SAFE_GIT_RUNNER_STATUS_OK_V1;
    result->exit_code = WEXITSTATUS(supervisor.child_status);
  } else if (result->status == SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 &&
             WIFSIGNALED(supervisor.child_status) &&
             WTERMSIG(supervisor.child_status) == SIGXCPU) {
    result->status = SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1;
  }

cleanup:
  if (supervisor.child > 0 && !supervisor.child_reaped) {
    safe_git_signal_payload_v1(&supervisor, &cgroup, SIGTERM, 0);
    (void)safe_git_wait_after_signal_v1(
        &supervisor, &cgroup, SAFE_GIT_RUNNER_TERMINATION_GRACE_NS_V1);
    safe_git_fail_stop_if_cleanup_incomplete_v1(&supervisor, &cgroup);
  }
  safe_git_close_fd_v1(&supervisor.stdout_fd);
  safe_git_close_fd_v1(&supervisor.stderr_fd);
  safe_git_close_fd_v1(&supervisor.setup_fd);
  safe_git_close_fd_v1(&supervisor.pidfd);
  safe_git_close_fd_v1(&stdout_pipe[0]);
  safe_git_close_fd_v1(&stdout_pipe[1]);
  safe_git_close_fd_v1(&stderr_pipe[0]);
  safe_git_close_fd_v1(&stderr_pipe[1]);
  safe_git_close_fd_v1(&setup_pipe[0]);
  safe_git_close_fd_v1(&setup_pipe[1]);
  safe_git_close_fd_v1(&dev_null);
  safe_git_close_elf_closure_v1(&closure);
  containment_cleanup_valid = safe_git_close_cgroup_v1(&cgroup);
  if (!containment_cleanup_valid &&
      result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
    result->status = SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1;
  }
  if (result->status != SAFE_GIT_RUNNER_STATUS_OK_V1 ||
      result->exit_code != 0 || supervisor.stdout_length != 0 ||
      supervisor.stderr_length != 0) {
    if (result->status == SAFE_GIT_RUNNER_STATUS_OK_V1) {
      result->status = SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1;
    }
    result->exit_code = -1;
  }
  safe_git_runner_secure_zero_v1(&stdout_byte, sizeof(stdout_byte));
  safe_git_runner_secure_zero_v1(arguments, sizeof(arguments));
  safe_git_runner_secure_zero_v1(&supervisor, sizeof(supervisor));
  safe_git_runner_secure_zero_v1(&clone_arguments, sizeof(clone_arguments));
  return 1;
}
