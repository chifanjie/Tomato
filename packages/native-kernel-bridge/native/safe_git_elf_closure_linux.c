#define _GNU_SOURCE

#include "safe_git_elf_closure_linux.h"

#include <elf.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <linux/openat2.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/types.h>
#include <unistd.h>

#if __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error "the SafeGit Linux ELF closure supports little-endian targets only"
#endif

#define SAFE_GIT_ELF_PROGRAM_HEADER_LIMIT_V1 ((size_t)256)
#define SAFE_GIT_ELF_NEEDED_LIMIT_V1 ((size_t)96)
#define SAFE_GIT_ELF_SONAME_LIMIT_V1 ((size_t)255)
#define SAFE_GIT_ELF_STRING_TABLE_LIMIT_V1 ((size_t)1048576)
#define SAFE_GIT_LD_CACHE_LIMIT_V1 ((size_t)16777216)
#define SAFE_GIT_LD_CACHE_HEADER_SIZE_V1 ((size_t)48)
#define SAFE_GIT_LD_CACHE_ENTRY_SIZE_V1 ((size_t)24)

struct safe_git_elf_description_v1 {
  int has_interpreter;
  char interpreter[PATH_MAX];
  size_t needed_count;
  char needed[SAFE_GIT_ELF_NEEDED_LIMIT_V1]
             [SAFE_GIT_ELF_SONAME_LIMIT_V1 + 1];
};

struct safe_git_ld_cache_v1 {
  int descriptor;
  unsigned char *bytes;
  size_t length;
  uint32_t entry_count;
};

static uint32_t safe_git_read_u32_le_v1(const unsigned char *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8U) |
         ((uint32_t)bytes[2] << 16U) | ((uint32_t)bytes[3] << 24U);
}

static uint64_t safe_git_read_u64_le_v1(const unsigned char *bytes) {
  return (uint64_t)safe_git_read_u32_le_v1(bytes) |
         ((uint64_t)safe_git_read_u32_le_v1(bytes + 4) << 32U);
}

static int safe_git_pread_exact_v1(int descriptor, void *buffer, size_t length,
                                   off_t offset) {
  size_t consumed = 0;
  while (consumed < length) {
    ssize_t amount = pread(descriptor, (unsigned char *)buffer + consumed,
                           length - consumed, offset + (off_t)consumed);
    if (amount < 0 && errno == EINTR) continue;
    if (amount <= 0) return 0;
    consumed += (size_t)amount;
  }
  return 1;
}

static int safe_git_current_elf_machine_v1(uint16_t machine) {
#if defined(__x86_64__)
  return machine == EM_X86_64;
#elif defined(__aarch64__)
  return machine == EM_AARCH64;
#else
  (void)machine;
  return 0;
#endif
}

static int safe_git_file_identity_equal_v1(const struct stat *left,
                                            const struct stat *right) {
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
         left->st_mode == right->st_mode && left->st_uid == right->st_uid &&
         left->st_gid == right->st_gid && left->st_size == right->st_size &&
         left->st_mtim.tv_sec == right->st_mtim.tv_sec &&
         left->st_mtim.tv_nsec == right->st_mtim.tv_nsec &&
         left->st_ctim.tv_sec == right->st_ctim.tv_sec &&
         left->st_ctim.tv_nsec == right->st_ctim.tv_nsec;
}

static int safe_git_root_immutable_regular_v1(const struct stat *metadata) {
  return S_ISREG(metadata->st_mode) && metadata->st_uid == 0 &&
         (metadata->st_mode & (S_IWGRP | S_IWOTH)) == 0 &&
         metadata->st_nlink > 0 && metadata->st_size > 0;
}

static int safe_git_root_immutable_directory_v1(const struct stat *metadata) {
  return S_ISDIR(metadata->st_mode) && metadata->st_uid == 0 &&
         (metadata->st_mode & (S_IWGRP | S_IWOTH)) == 0;
}

static int safe_git_path_has_trusted_prefix_v1(const char *path) {
  static const char *const prefixes[] = {
      "/lib/", "/lib64/", "/usr/lib/", "/usr/lib64/",
  };
  size_t index;
  if (strcmp(path, "/etc/ld.so.cache") == 0) return 1;
  for (index = 0; index < sizeof(prefixes) / sizeof(prefixes[0]); index += 1) {
    size_t length = strlen(prefixes[index]);
    if (strncmp(path, prefixes[index], length) == 0) return 1;
  }
  return 0;
}

/*
 * Validate the kernel-resolved pathname component-by-component after opening
 * it. The opened inode is the authority; the resolved path is used only to
 * prove every parent is root-owned and non-writable by group/other.
 */
static int safe_git_validate_resolved_parent_chain_v1(
    int descriptor, const struct stat *opened_metadata) {
  char proc_path[64];
  char resolved[PATH_MAX + 1];
  char component[NAME_MAX + 1];
  struct stat metadata;
  struct stat final_metadata;
  int directory = -1;
  size_t cursor = 1;
  size_t length;
  ssize_t amount;

  if (snprintf(proc_path, sizeof(proc_path), "/proc/self/fd/%d", descriptor) <=
      0) {
    return 0;
  }
  amount = readlink(proc_path, resolved, PATH_MAX);
  if (amount <= 0 || amount >= PATH_MAX) return 0;
  resolved[amount] = '\0';
  length = (size_t)amount;
  if (resolved[0] != '/' || strstr(resolved, " (deleted)") != NULL ||
      !safe_git_path_has_trusted_prefix_v1(resolved)) {
    return 0;
  }

  directory = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (directory < 0 || fstat(directory, &metadata) != 0 ||
      !safe_git_root_immutable_directory_v1(&metadata)) {
    if (directory >= 0) (void)close(directory);
    return 0;
  }

  while (cursor < length) {
    size_t end = cursor;
    size_t component_length;
    while (end < length && resolved[end] != '/') end += 1;
    component_length = end - cursor;
    if (component_length == 0 || component_length > NAME_MAX) goto failure;
    memcpy(component, resolved + cursor, component_length);
    component[component_length] = '\0';
    if (end == length) {
      if (fstatat(directory, component, &final_metadata,
                  AT_SYMLINK_NOFOLLOW) != 0 ||
          !safe_git_file_identity_equal_v1(opened_metadata, &final_metadata)) {
        goto failure;
      }
      (void)close(directory);
      return 1;
    } else {
      int child = openat(directory, component,
                         O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
      if (child < 0 || fstat(child, &metadata) != 0 ||
          !safe_git_root_immutable_directory_v1(&metadata)) {
        if (child >= 0) (void)close(child);
        goto failure;
      }
      (void)close(directory);
      directory = child;
    }
    cursor = end + 1;
  }

failure:
  (void)close(directory);
  return 0;
}

static int safe_git_open_trusted_absolute_v1(const char *path) {
  struct open_how how;
  struct stat first;
  struct stat second;
  int root = -1;
  int descriptor = -1;
  size_t length = path == NULL ? 0 : strlen(path);
  if (length < 2 || length >= PATH_MAX || path[0] != '/' ||
      !safe_git_path_has_trusted_prefix_v1(path)) {
    return -1;
  }
  memset(&how, 0, sizeof(how));
  how.flags = O_RDONLY | O_CLOEXEC;
  how.resolve = RESOLVE_BENEATH | RESOLVE_NO_MAGICLINKS;
  root = open("/", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (root < 0) return -1;
  descriptor = (int)syscall(SYS_openat2, root, path + 1, &how, sizeof(how));
  (void)close(root);
  if (descriptor < 0 || fstat(descriptor, &first) != 0 ||
      !safe_git_root_immutable_regular_v1(&first) ||
      !safe_git_validate_resolved_parent_chain_v1(descriptor, &first) ||
      fstat(descriptor, &second) != 0 ||
      !safe_git_file_identity_equal_v1(&first, &second)) {
    if (descriptor >= 0) (void)close(descriptor);
    return -1;
  }
  return descriptor;
}

static int safe_git_elf_virtual_to_file_offset_v1(
    const Elf64_Phdr *headers, size_t header_count, Elf64_Addr address,
    size_t length, off_t *offset) {
  size_t index;
  for (index = 0; index < header_count; index += 1) {
    const Elf64_Phdr *header = &headers[index];
    uint64_t relative;
    if (header->p_type != PT_LOAD || address < header->p_vaddr) continue;
    relative = (uint64_t)(address - header->p_vaddr);
    if (relative > header->p_filesz || length > header->p_filesz - relative ||
        header->p_offset > (uint64_t)INT64_MAX - relative) {
      continue;
    }
    *offset = (off_t)(header->p_offset + relative);
    return 1;
  }
  return 0;
}

static int safe_git_describe_elf_v1(
    int descriptor, int require_interpreter,
    struct safe_git_elf_description_v1 *description) {
  Elf64_Ehdr header;
  Elf64_Phdr *program_headers = NULL;
  Elf64_Dyn *dynamic_entries = NULL;
  unsigned char *string_table = NULL;
  struct stat before;
  struct stat after;
  off_t dynamic_offset = 0;
  size_t dynamic_size = 0;
  Elf64_Addr string_address = 0;
  size_t string_size = 0;
  size_t dynamic_count;
  size_t index;
  int success = 0;

  memset(description, 0, sizeof(*description));
  if (fstat(descriptor, &before) != 0 || !S_ISREG(before.st_mode) ||
      before.st_size < (off_t)sizeof(header) ||
      !safe_git_pread_exact_v1(descriptor, &header, sizeof(header), 0) ||
      memcmp(header.e_ident, ELFMAG, SELFMAG) != 0 ||
      header.e_ident[EI_CLASS] != ELFCLASS64 ||
      header.e_ident[EI_DATA] != ELFDATA2LSB ||
      header.e_ident[EI_VERSION] != EV_CURRENT || header.e_version != EV_CURRENT ||
      (header.e_type != ET_EXEC && header.e_type != ET_DYN) ||
      !safe_git_current_elf_machine_v1(header.e_machine) ||
      header.e_ehsize != sizeof(Elf64_Ehdr) ||
      header.e_phentsize != sizeof(Elf64_Phdr) || header.e_phnum == 0 ||
      header.e_phnum > SAFE_GIT_ELF_PROGRAM_HEADER_LIMIT_V1 ||
      header.e_phoff > (Elf64_Off)INT64_MAX ||
      (uint64_t)header.e_phnum * sizeof(Elf64_Phdr) >
          (uint64_t)before.st_size - header.e_phoff) {
    goto cleanup;
  }
  program_headers = calloc(header.e_phnum, sizeof(Elf64_Phdr));
  if (program_headers == NULL ||
      !safe_git_pread_exact_v1(
          descriptor, program_headers,
          (size_t)header.e_phnum * sizeof(Elf64_Phdr),
          (off_t)header.e_phoff)) {
    goto cleanup;
  }

  for (index = 0; index < header.e_phnum; index += 1) {
    const Elf64_Phdr *program = &program_headers[index];
    if (program->p_type == PT_GNU_STACK && (program->p_flags & PF_X) != 0) {
      goto cleanup;
    }
    if (program->p_type == PT_INTERP) {
      size_t interpreter_length;
      if (description->has_interpreter || program->p_filesz < 2 ||
          program->p_filesz >= sizeof(description->interpreter) ||
          program->p_offset > (uint64_t)INT64_MAX ||
          program->p_filesz > (uint64_t)before.st_size - program->p_offset ||
          !safe_git_pread_exact_v1(descriptor, description->interpreter,
                                   (size_t)program->p_filesz,
                                   (off_t)program->p_offset)) {
        goto cleanup;
      }
      interpreter_length = strnlen(description->interpreter,
                                   (size_t)program->p_filesz);
      if (interpreter_length + 1 != program->p_filesz ||
          description->interpreter[0] != '/' ||
          !safe_git_path_has_trusted_prefix_v1(description->interpreter)) {
        goto cleanup;
      }
      description->has_interpreter = 1;
    } else if (program->p_type == PT_DYNAMIC) {
      if (dynamic_size != 0 || program->p_filesz < sizeof(Elf64_Dyn) ||
          program->p_filesz % sizeof(Elf64_Dyn) != 0 ||
          program->p_filesz > SAFE_GIT_ELF_STRING_TABLE_LIMIT_V1 ||
          program->p_offset > (uint64_t)INT64_MAX ||
          program->p_filesz > (uint64_t)before.st_size - program->p_offset) {
        goto cleanup;
      }
      dynamic_offset = (off_t)program->p_offset;
      dynamic_size = (size_t)program->p_filesz;
    }
  }
  /*
   * Modern glibc ships libc.so.6 as both a loadable dependency and a directly
   * executable diagnostic binary, so libc can legitimately carry PT_INTERP.
   * The kernel consults PT_INTERP only for the root executable; an optional,
   * already-validated PT_INTERP on a DT_NEEDED object is inert when the loader
   * maps that object and must not make the exact closure unavailable.
   */
  if ((require_interpreter && !description->has_interpreter) ||
      dynamic_size == 0) {
    goto cleanup;
  }

  dynamic_entries = malloc(dynamic_size);
  if (dynamic_entries == NULL ||
      !safe_git_pread_exact_v1(descriptor, dynamic_entries, dynamic_size,
                               dynamic_offset)) {
    goto cleanup;
  }
  dynamic_count = dynamic_size / sizeof(Elf64_Dyn);
  for (index = 0; index < dynamic_count; index += 1) {
    Elf64_Sxword tag = dynamic_entries[index].d_tag;
    if (tag == DT_NULL) break;
    if (tag == DT_STRTAB) {
      if (string_address != 0) goto cleanup;
      string_address = dynamic_entries[index].d_un.d_ptr;
    } else if (tag == DT_STRSZ) {
      if (string_size != 0 || dynamic_entries[index].d_un.d_val == 0 ||
          dynamic_entries[index].d_un.d_val >
              SAFE_GIT_ELF_STRING_TABLE_LIMIT_V1) {
        goto cleanup;
      }
      string_size = (size_t)dynamic_entries[index].d_un.d_val;
    } else if (tag == DT_RPATH || tag == DT_RUNPATH || tag == DT_AUDIT ||
               tag == DT_DEPAUDIT || tag == DT_FILTER || tag == DT_AUXILIARY ||
               tag == DT_TEXTREL ||
               (tag == DT_FLAGS &&
                (dynamic_entries[index].d_un.d_val & DF_TEXTREL) != 0)) {
      goto cleanup;
    }
  }
  if (index == dynamic_count || string_address == 0 || string_size == 0 ||
      !safe_git_elf_virtual_to_file_offset_v1(
          program_headers, header.e_phnum, string_address, string_size,
          &dynamic_offset)) {
    goto cleanup;
  }
  string_table = malloc(string_size);
  if (string_table == NULL ||
      !safe_git_pread_exact_v1(descriptor, string_table, string_size,
                               dynamic_offset)) {
    goto cleanup;
  }

  for (index = 0; index < dynamic_count && dynamic_entries[index].d_tag != DT_NULL;
       index += 1) {
    if (dynamic_entries[index].d_tag == DT_NEEDED) {
      uint64_t name_offset = dynamic_entries[index].d_un.d_val;
      size_t remaining;
      size_t name_length;
      const unsigned char *name;
      if (description->needed_count >= SAFE_GIT_ELF_NEEDED_LIMIT_V1 ||
          name_offset >= string_size) {
        goto cleanup;
      }
      remaining = string_size - (size_t)name_offset;
      name = string_table + name_offset;
      name_length = strnlen((const char *)name, remaining);
      if (name_length == 0 || name_length > SAFE_GIT_ELF_SONAME_LIMIT_V1 ||
          name_length == remaining || memchr(name, '/', name_length) != NULL ||
          memchr(name, '\\', name_length) != NULL) {
        goto cleanup;
      }
      memcpy(description->needed[description->needed_count], name,
             name_length + 1);
      description->needed_count += 1;
    }
  }
  if (fstat(descriptor, &after) != 0 ||
      !safe_git_file_identity_equal_v1(&before, &after)) {
    goto cleanup;
  }
  success = 1;

cleanup:
  if (string_table != NULL) {
    memset(string_table, 0, string_size);
    free(string_table);
  }
  if (dynamic_entries != NULL) {
    memset(dynamic_entries, 0, dynamic_size);
    free(dynamic_entries);
  }
  free(program_headers);
  if (!success) memset(description, 0, sizeof(*description));
  return success;
}

static void safe_git_close_ld_cache_v1(struct safe_git_ld_cache_v1 *cache) {
  if (cache->descriptor >= 0) (void)close(cache->descriptor);
  if (cache->bytes != NULL) {
    memset(cache->bytes, 0, cache->length);
    free(cache->bytes);
  }
  memset(cache, 0, sizeof(*cache));
  cache->descriptor = -1;
}

static int safe_git_open_ld_cache_v1(struct safe_git_ld_cache_v1 *cache) {
  static const unsigned char magic[] = "glibc-ld.so.cache";
  static const unsigned char version[] = "1.1";
  struct stat metadata;
  size_t entries_size;
  uint32_t strings_length;
  memset(cache, 0, sizeof(*cache));
  cache->descriptor = -1;
  cache->descriptor = safe_git_open_trusted_absolute_v1("/etc/ld.so.cache");
  if (cache->descriptor < 0 || fstat(cache->descriptor, &metadata) != 0 ||
      metadata.st_size < (off_t)SAFE_GIT_LD_CACHE_HEADER_SIZE_V1 ||
      metadata.st_size > (off_t)SAFE_GIT_LD_CACHE_LIMIT_V1) {
    safe_git_close_ld_cache_v1(cache);
    return 0;
  }
  cache->length = (size_t)metadata.st_size;
  cache->bytes = malloc(cache->length);
  if (cache->bytes == NULL ||
      !safe_git_pread_exact_v1(cache->descriptor, cache->bytes, cache->length,
                               0) ||
      memcmp(cache->bytes, magic, sizeof(magic) - 1) != 0 ||
      memcmp(cache->bytes + sizeof(magic) - 1, version,
             sizeof(version) - 1) != 0) {
    safe_git_close_ld_cache_v1(cache);
    return 0;
  }
  cache->entry_count = safe_git_read_u32_le_v1(cache->bytes + 20);
  strings_length = safe_git_read_u32_le_v1(cache->bytes + 24);
  if (cache->entry_count == 0 ||
      cache->entry_count >
          (SAFE_GIT_LD_CACHE_LIMIT_V1 / SAFE_GIT_LD_CACHE_ENTRY_SIZE_V1)) {
    safe_git_close_ld_cache_v1(cache);
    return 0;
  }
  entries_size = (size_t)cache->entry_count * SAFE_GIT_LD_CACHE_ENTRY_SIZE_V1;
  if (entries_size > cache->length - SAFE_GIT_LD_CACHE_HEADER_SIZE_V1 ||
      strings_length > cache->length - SAFE_GIT_LD_CACHE_HEADER_SIZE_V1 -
                           entries_size) {
    safe_git_close_ld_cache_v1(cache);
    return 0;
  }
  return 1;
}

static const char *safe_git_cache_string_v1(
    const struct safe_git_ld_cache_v1 *cache, uint32_t offset) {
  const unsigned char *begin;
  size_t remaining;
  if ((size_t)offset >= cache->length) return NULL;
  begin = cache->bytes + offset;
  remaining = cache->length - (size_t)offset;
  if (memchr(begin, '\0', remaining) == NULL) return NULL;
  return (const char *)begin;
}

static int safe_git_descriptor_matches_machine_v1(int descriptor) {
  Elf64_Ehdr header;
  return safe_git_pread_exact_v1(descriptor, &header, sizeof(header), 0) &&
         memcmp(header.e_ident, ELFMAG, SELFMAG) == 0 &&
         header.e_ident[EI_CLASS] == ELFCLASS64 &&
         header.e_ident[EI_DATA] == ELFDATA2LSB &&
         safe_git_current_elf_machine_v1(header.e_machine);
}

static int safe_git_resolve_needed_v1(
    const struct safe_git_ld_cache_v1 *cache, const char *soname) {
  static const char *const directories[] = {
#if defined(__x86_64__)
      "/lib/x86_64-linux-gnu", "/usr/lib/x86_64-linux-gnu",
#elif defined(__aarch64__)
      "/lib/aarch64-linux-gnu", "/usr/lib/aarch64-linux-gnu",
#endif
      "/lib64", "/usr/lib64", "/lib", "/usr/lib",
  };
  uint32_t index;
  size_t directory_index;
  for (index = 0; index < cache->entry_count; index += 1) {
    size_t offset = SAFE_GIT_LD_CACHE_HEADER_SIZE_V1 +
                    (size_t)index * SAFE_GIT_LD_CACHE_ENTRY_SIZE_V1;
    uint32_t key_offset = safe_git_read_u32_le_v1(cache->bytes + offset + 4);
    uint32_t value_offset = safe_git_read_u32_le_v1(cache->bytes + offset + 8);
    uint64_t hwcap = safe_git_read_u64_le_v1(cache->bytes + offset + 16);
    const char *key = safe_git_cache_string_v1(cache, key_offset);
    const char *value = safe_git_cache_string_v1(cache, value_offset);
    int descriptor;
    /* A non-zero legacy hwcap requires glibc CPU selection we cannot mirror. */
    if (hwcap != 0 || key == NULL || value == NULL || strcmp(key, soname) != 0 ||
        !safe_git_path_has_trusted_prefix_v1(value)) {
      continue;
    }
    descriptor = safe_git_open_trusted_absolute_v1(value);
    if (descriptor >= 0 && safe_git_descriptor_matches_machine_v1(descriptor)) {
      return descriptor;
    }
    if (descriptor >= 0) (void)close(descriptor);
  }
  for (directory_index = 0;
       directory_index < sizeof(directories) / sizeof(directories[0]);
       directory_index += 1) {
    char path[PATH_MAX];
    int length = snprintf(path, sizeof(path), "%s/%s",
                          directories[directory_index], soname);
    int descriptor;
    if (length <= 0 || (size_t)length >= sizeof(path)) continue;
    descriptor = safe_git_open_trusted_absolute_v1(path);
    if (descriptor >= 0 && safe_git_descriptor_matches_machine_v1(descriptor)) {
      return descriptor;
    }
    if (descriptor >= 0) (void)close(descriptor);
  }
  return -1;
}

static int safe_git_closure_contains_v1(
    const struct safe_git_elf_closure_v1 *closure,
    const struct stat *candidate) {
  size_t index;
  for (index = 0; index < closure->file_count; index += 1) {
    struct stat existing;
    if (fstat(closure->files[index].path_fd, &existing) == 0 &&
        existing.st_dev == candidate->st_dev &&
        existing.st_ino == candidate->st_ino) {
      return 1;
    }
  }
  return 0;
}

static int safe_git_append_closure_file_v1(
    struct safe_git_elf_closure_v1 *closure, int descriptor,
    int allow_execute) {
  struct stat metadata;
  if (descriptor < 0 || fstat(descriptor, &metadata) != 0) return 0;
  if (safe_git_closure_contains_v1(closure, &metadata)) {
    (void)close(descriptor);
    return 1;
  }
  if (closure->file_count >= SAFE_GIT_ELF_CLOSURE_FILE_LIMIT_V1) return 0;
  closure->files[closure->file_count].path_fd = descriptor;
  closure->files[closure->file_count].allow_execute = allow_execute;
  closure->file_count += 1;
  return 1;
}

void safe_git_close_elf_closure_v1(
    struct safe_git_elf_closure_v1 *closure) {
  size_t index;
  if (closure == NULL) return;
  for (index = 0; index < closure->file_count; index += 1) {
    if (closure->files[index].path_fd >= 0) {
      (void)close(closure->files[index].path_fd);
    }
  }
  memset(closure, 0, sizeof(*closure));
}

int safe_git_open_elf_closure_v1(
    int executable_fd, struct safe_git_elf_closure_v1 *closure) {
  struct safe_git_ld_cache_v1 cache;
  size_t parse_cursor = 0;
  size_t parse_limit = 0;
  int executable_copy = -1;
  int interpreter_added = 0;
  int success = 0;

  if (closure == NULL || executable_fd < 0) return 0;
  memset(closure, 0, sizeof(*closure));
  memset(&cache, 0, sizeof(cache));
  cache.descriptor = -1;
  executable_copy = fcntl(executable_fd, F_DUPFD_CLOEXEC, 3);
  if (executable_copy < 0 ||
      !safe_git_append_closure_file_v1(closure, executable_copy, 1)) {
    if (executable_copy >= 0) (void)close(executable_copy);
    goto cleanup;
  }
  parse_limit = closure->file_count;
  if (!safe_git_open_ld_cache_v1(&cache)) goto cleanup;

  while (parse_cursor < parse_limit) {
    struct safe_git_elf_description_v1 description;
    size_t needed_index;
    if (!safe_git_describe_elf_v1(
            closure->files[parse_cursor].path_fd, parse_cursor == 0,
            &description)) {
      goto cleanup;
    }
    if (parse_cursor == 0) {
      int interpreter =
          safe_git_open_trusted_absolute_v1(description.interpreter);
      if (interpreter < 0 ||
          !safe_git_descriptor_matches_machine_v1(interpreter) ||
          !safe_git_append_closure_file_v1(closure, interpreter, 1)) {
        if (interpreter >= 0) (void)close(interpreter);
        goto cleanup;
      }
      interpreter_added = 1;
      parse_limit = closure->file_count;
    }
    for (needed_index = 0; needed_index < description.needed_count;
         needed_index += 1) {
      int dependency = safe_git_resolve_needed_v1(
          &cache, description.needed[needed_index]);
      size_t before_count = closure->file_count;
      if (dependency < 0 ||
          !safe_git_append_closure_file_v1(closure, dependency, 0)) {
        if (dependency >= 0) (void)close(dependency);
        goto cleanup;
      }
      if (closure->file_count != before_count) parse_limit += 1;
    }
    memset(&description, 0, sizeof(description));
    parse_cursor += 1;
  }
  if (!interpreter_added || cache.descriptor < 0 ||
      !safe_git_append_closure_file_v1(closure, cache.descriptor, 0)) {
    goto cleanup;
  }
  cache.descriptor = -1;
  success = 1;

cleanup:
  safe_git_close_ld_cache_v1(&cache);
  if (!success) safe_git_close_elf_closure_v1(closure);
  return success;
}
