#ifndef UNDERSTAND_CODE_SAFE_GIT_RUNNER_INTERNAL_H
#define UNDERSTAND_CODE_SAFE_GIT_RUNNER_INTERNAL_H

#include <stddef.h>

#define SAFE_GIT_RUNNER_VERSION_STDOUT_LIMIT_V1 128
#define SAFE_GIT_RUNNER_READ_STDOUT_LIMIT_V1 ((size_t)67108864)
#define SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 ((size_t)1024)

enum safe_git_runner_status_v1 {
  SAFE_GIT_RUNNER_STATUS_OK_V1 = 0,
  SAFE_GIT_RUNNER_STATUS_UNAVAILABLE_V1 = 1,
  SAFE_GIT_RUNNER_STATUS_EXECUTION_FAILED_V1 = 2,
  SAFE_GIT_RUNNER_STATUS_STDOUT_LIMIT_V1 = 3,
  SAFE_GIT_RUNNER_STATUS_STDERR_LIMIT_V1 = 4,
  SAFE_GIT_RUNNER_STATUS_TIMEOUT_V1 = 5,
  SAFE_GIT_RUNNER_STATUS_RESOURCE_LIMIT_V1 = 6,
};

struct safe_git_runner_version_result_v1 {
  enum safe_git_runner_status_v1 status;
  unsigned char stdout_bytes[SAFE_GIT_RUNNER_VERSION_STDOUT_LIMIT_V1];
  size_t stdout_length;
};

enum safe_git_runner_read_profile_v1 {
  SAFE_GIT_RUNNER_READ_REV_PARSE_SHOW_TOPLEVEL_V1 = 1,
  SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_GIT_DIR_V1 = 2,
  SAFE_GIT_RUNNER_READ_REV_PARSE_ABSOLUTE_COMMON_GIT_DIR_V1 = 3,
  SAFE_GIT_RUNNER_READ_STATUS_PORCELAIN_V2_V1 = 4,
  SAFE_GIT_RUNNER_READ_REV_PARSE_HEAD_COMMIT_V1 = 5,
  SAFE_GIT_RUNNER_READ_SYMBOLIC_HEAD_V1 = 6,
  SAFE_GIT_RUNNER_READ_LS_FILES_STAGE_V1 = 7,
  SAFE_GIT_RUNNER_READ_REV_PARSE_BASELINE_COMMIT_V1 = 8,
  SAFE_GIT_RUNNER_READ_MERGE_BASE_V1 = 9,
  SAFE_GIT_RUNNER_READ_REV_LIST_AHEAD_BEHIND_V1 = 10,
  SAFE_GIT_RUNNER_READ_DIFF_COMMITTED_NAME_STATUS_V1 = 11,
  SAFE_GIT_RUNNER_READ_DIFF_STAGED_NAME_STATUS_V1 = 12,
  SAFE_GIT_RUNNER_READ_CAT_FILE_OBJECT_V1 = 13,
  SAFE_GIT_RUNNER_READ_LS_IGNORE_FILES_V1 = 14,
  SAFE_GIT_RUNNER_READ_CONFIG_GLOBAL_EXCLUDES_FILE_V1 = 15,
  SAFE_GIT_RUNNER_READ_CAT_FILE_TYPE_V1 = 16,
};

struct safe_git_runner_read_request_v1 {
  enum safe_git_runner_read_profile_v1 profile;
  char parameter_one[SAFE_GIT_RUNNER_READ_REVISION_LIMIT_V1 + 1];
  char parameter_two[65];
};

struct safe_git_runner_read_result_v1 {
  enum safe_git_runner_status_v1 status;
  int exit_code;
  unsigned char *stdout_bytes;
  size_t stdout_length;
  size_t stdout_capacity;
};

#define SAFE_GIT_RUNNER_TASK_ID_LENGTH_V1 ((size_t)26)
#define SAFE_GIT_RUNNER_SNAPSHOT_ID_LENGTH_V1 ((size_t)73)
#define SAFE_GIT_RUNNER_MARKER_NONCE_LENGTH_V1 ((size_t)32)
#define SAFE_GIT_RUNNER_CONTENT_DIGEST_LENGTH_V1 ((size_t)71)

struct safe_git_runner_lease_request_v1 {
  int delete_ref;
  char ref_name[111];
  char object_id[65];
  char zero_object_id[65];
};

struct safe_git_runner_lease_result_v1 {
  enum safe_git_runner_status_v1 status;
  int exit_code;
};

/*
 * Runs exactly `<retained executable> --version` in the Linux strong
 * containment profile. The implementation derives its cgroup authority from
 * the kernel-owned current-process membership; callers cannot supply a path,
 * environment, sandbox root, or process policy. Failure details are reduced to
 * a stable status and stderr/path/PID bytes never cross this boundary.
 */
int safe_git_run_linux_version_v1(
    int retained_executable_fd, const char *canonical_argv0,
    struct safe_git_runner_version_result_v1 *result);

/*
 * Executes one frozen repository-read profile. Repository and empty-hooks
 * authority are native-retained descriptors; callers cannot supply argv,
 * cwd, paths, environment, output limits, or process policy.
 */
int safe_git_run_linux_read_v1(
    int retained_executable_fd, const char *canonical_argv0,
    int retained_workspace_root_fd, int retained_git_directory_fd,
    int retained_common_directory_fd, int retained_empty_hooks_directory_fd,
    const struct safe_git_runner_read_request_v1 *request,
    struct safe_git_runner_read_result_v1 *result);

void safe_git_release_linux_read_result_v1(
    struct safe_git_runner_read_result_v1 *result);

/* Executes only the frozen create-only baseline-ref CAS. */
int safe_git_run_linux_create_lease_v1(
    int retained_executable_fd, const char *canonical_argv0,
    int retained_workspace_root_fd, int retained_git_directory_fd,
    int retained_common_directory_fd, int retained_empty_hooks_directory_fd,
    int retained_lease_namespace_fd,
    const struct safe_git_runner_lease_request_v1 *request,
    struct safe_git_runner_lease_result_v1 *result);

#ifdef SAFE_GIT_RUNNER_TESTING
/* Compile-time-only seam; never present in the production addon. */
int safe_git_runner_test_incomplete_cleanup_fail_stop_v1(void);
#endif

#endif
