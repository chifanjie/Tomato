#ifndef UNDERSTAND_CODE_SAFE_GIT_ELF_CLOSURE_LINUX_H
#define UNDERSTAND_CODE_SAFE_GIT_ELF_CLOSURE_LINUX_H

#if !defined(__linux__)
#error "safe_git_elf_closure_linux.h is Linux-only"
#endif

#include <stddef.h>

#define SAFE_GIT_ELF_CLOSURE_FILE_LIMIT_V1 ((size_t)128)

struct safe_git_elf_closure_file_v1 {
  int path_fd;
  int allow_execute;
};

struct safe_git_elf_closure_v1 {
  size_t file_count;
  struct safe_git_elf_closure_file_v1
      files[SAFE_GIT_ELF_CLOSURE_FILE_LIMIT_V1];
};

/* Every returned descriptor is O_PATH|O_NOFOLLOW and root-owned immutable. */
int safe_git_open_elf_closure_v1(int executable_fd,
                                struct safe_git_elf_closure_v1 *closure);
void safe_git_close_elf_closure_v1(struct safe_git_elf_closure_v1 *closure);

#endif
