#include "safe_git_runner_internal.h"

#include <stdio.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
  pid_t child = fork();
  int status = 0;
  if (child < 0) return 90;
  if (child == 0) {
    return safe_git_runner_test_incomplete_cleanup_fail_stop_v1();
  }
  if (waitpid(child, &status, 0) != child || !WIFEXITED(status) ||
      WEXITSTATUS(status) != 127) {
    return 91;
  }
  if (puts("safe_git_cleanup_failure_seam=fail_stop_verified") < 0) return 92;
  return 0;
}
