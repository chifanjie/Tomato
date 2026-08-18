#if defined(__linux__)
#define _GNU_SOURCE
#endif

#include <limits.h>
#include <math.h>
#include <node_api.h>
#include <stdint.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <sys/un.h>
#if defined(__APPLE__)
#define __APPLE_API_UNSTABLE
#include <sys/ucred.h>
#undef __APPLE_API_UNSTABLE
#endif
#include <unistd.h>

static napi_value throw_unavailable(napi_env env) {
  napi_value code;
  napi_value error;
  napi_value message;
  const char *code_text =
      "ERR_PROVIDER_KERNEL_PEER_CREDENTIALS_UNAVAILABLE";
  const char *message_text = "kernel peer credentials are unavailable";

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

static int read_file_descriptor(napi_env env, napi_callback_info info,
                                int *file_descriptor) {
  size_t argument_count = 1;
  napi_value argument;
  napi_valuetype argument_type;
  double numeric_value;

  if (napi_get_cb_info(env, info, &argument_count, &argument, NULL, NULL) !=
          napi_ok ||
      argument_count != 1 ||
      napi_typeof(env, argument, &argument_type) != napi_ok ||
      argument_type != napi_number ||
      napi_get_value_double(env, argument, &numeric_value) != napi_ok ||
      !isfinite(numeric_value) || numeric_value < 0 ||
      numeric_value > INT_MAX || trunc(numeric_value) != numeric_value) {
    return 0;
  }

  *file_descriptor = (int)numeric_value;
  return numeric_value == (double)*file_descriptor;
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

NAPI_MODULE_INIT() {
  napi_property_descriptor descriptor = {
      "readPeerCredentials", NULL, read_peer_credentials, NULL, NULL, NULL,
      napi_default, NULL};

  if (napi_define_properties(env, exports, 1, &descriptor) != napi_ok) {
    return throw_unavailable(env);
  }
  return exports;
}
