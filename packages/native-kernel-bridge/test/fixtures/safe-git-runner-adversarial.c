#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <linux/sched.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/sysmacros.h>
#include <unistd.h>

#define SAFE_GIT_EXEC_FD_V1 200

static int expect_denied(int result) {
  return result == -1 && (errno == EPERM || errno == EACCES);
}

int main(int argc, char **argv, char **environment) {
  struct stat metadata;
  int descriptor;
  char *const reexec_arguments[] = {argv[0], (char *)"--version", NULL};
  static const char output[] = "git version 9.9.9\n";

  if (argc != 2 || strcmp(argv[1], "--version") != 0) return 80;

  /* The initial exec authority must not survive the successful exec. */
  errno = 0;
  if (fcntl(SAFE_GIT_EXEC_FD_V1, F_GETFD) != -1 || errno != EBADF) return 81;
  errno = 0;
  if (syscall(SYS_execveat, SAFE_GIT_EXEC_FD_V1, "", reexec_arguments,
              environment, AT_EMPTY_PATH) != -1 ||
      errno != EBADF) {
    return 82;
  }

  descriptor = open("/dev/null", O_RDWR | O_NOCTTY | O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &metadata) != 0 ||
      !S_ISCHR(metadata.st_mode) || metadata.st_uid != 0 ||
      metadata.st_nlink == 0 || metadata.st_rdev != makedev(1, 3) ||
      close(descriptor) != 0) {
    return 83;
  }

  errno = 0;
  descriptor = open("/dev/zero", O_RDWR | O_NOCTTY | O_CLOEXEC);
  if (descriptor >= 0) {
    (void)close(descriptor);
    return 84;
  }
  if (!expect_denied(-1)) return 85;

  errno = 0;
  descriptor = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  if (descriptor >= 0) {
    (void)close(descriptor);
    return 86;
  }
  if (!expect_denied(-1)) return 87;

#ifdef SYS_unshare
  errno = 0;
  if (!expect_denied((int)syscall(SYS_unshare, CLONE_NEWUSER))) return 88;
#endif

  if (write(STDOUT_FILENO, output, sizeof(output) - 1U) !=
      (ssize_t)(sizeof(output) - 1U)) {
    return 89;
  }
  return 0;
}
