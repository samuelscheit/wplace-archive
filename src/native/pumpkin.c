#include "pumpkin_core.h"
#include <node_api.h>
#include <stdlib.h>
#include <string.h>

#define NAPI_CALL(env, call)                                                   \
  do {                                                                         \
    napi_status status = (call);                                               \
    if (status != napi_ok) {                                                   \
      const napi_extended_error_info *info;                                    \
      napi_get_last_error_info((env), &info);                                  \
      const char *message = info ? info->error_message : "Unknown error";      \
      napi_throw_error((env), NULL, message);                                  \
      return NULL;                                                             \
    }                                                                          \
  } while (0)

static pumpkin_t g_pumpkin = {0};

static napi_value js_set_pumpkin(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (argc < 4) {
    napi_throw_type_error(env, NULL,
                          "Expected buffer, width, height, channels");
    return NULL;
  }

  void *data_ptr;
  size_t data_len;
  uint32_t w, h, c;

  NAPI_CALL(env, napi_get_buffer_info(env, argv[0], &data_ptr, &data_len));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[1], &w));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[2], &h));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[3], &c));

  size_t expected = (size_t)w * h * c;
  if (data_len < expected) {
    napi_throw_range_error(env, NULL, "Buffer smaller than expected");
    return NULL;
  }

  if (!pumpkin_init(&g_pumpkin, data_ptr, w, h, c)) {
    napi_throw_error(env, NULL, "Failed to init pumpkin");
    return NULL;
  }

  napi_value result;
  NAPI_CALL(env,
            napi_create_uint32(env, (uint32_t)g_pumpkin.pixel_count, &result));
  return result;
}

static napi_value js_find_pumpkin(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (!g_pumpkin.rgba) {
    napi_throw_error(env, NULL, "Pumpkin not initialized");
    return NULL;
  }

  void *data_ptr;
  size_t data_len;
  uint32_t w, h, c;

  NAPI_CALL(env, napi_get_buffer_info(env, argv[0], &data_ptr, &data_len));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[1], &w));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[2], &h));
  NAPI_CALL(env, napi_get_value_uint32(env, argv[3], &c));

  size_t expected = (size_t)w * h * c;
  if (data_len < expected) {
    napi_throw_range_error(env, NULL, "Buffer smaller than expected");
    return NULL;
  }

  uint32_t fx = 0, fy = 0;
  bool found = pumpkin_find(&g_pumpkin, data_ptr, w, h, c, &fx, &fy);

  if (!found) {
    napi_value null_value;
    NAPI_CALL(env, napi_get_null(env, &null_value));
    return null_value;
  }

  napi_value obj, xval, yval;
  NAPI_CALL(env, napi_create_object(env, &obj));
  NAPI_CALL(env, napi_create_uint32(env, fx, &xval));
  NAPI_CALL(env, napi_create_uint32(env, fy, &yval));
  NAPI_CALL(env, napi_set_named_property(env, obj, "x", xval));
  NAPI_CALL(env, napi_set_named_property(env, obj, "y", yval));
  return obj;
}

static napi_value js_destroy_pumpkin(napi_env env, napi_callback_info info) {
  pumpkin_destroy(&g_pumpkin);
  return NULL;
}

static void addon_destroy(void *arg) {
  (void)arg;
  pumpkin_destroy(&g_pumpkin);
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value set_fn;
  NAPI_CALL(env, napi_create_function(env, "setPumpkinData", NAPI_AUTO_LENGTH,
                                      js_set_pumpkin, NULL, &set_fn));
  NAPI_CALL(env,
            napi_set_named_property(env, exports, "setPumpkinData", set_fn));

  napi_value find_fn;
  NAPI_CALL(env, napi_create_function(env, "findPumpkin", NAPI_AUTO_LENGTH,
                                      js_find_pumpkin, NULL, &find_fn));
  NAPI_CALL(env, napi_set_named_property(env, exports, "findPumpkin", find_fn));

  napi_value destroy_fn;
  NAPI_CALL(env,
            napi_create_function(env, "destoryPumpkinData", NAPI_AUTO_LENGTH,
                                 js_destroy_pumpkin, NULL, &destroy_fn));
  NAPI_CALL(env, napi_set_named_property(env, exports, "destoryPumpkinData",
                                         destroy_fn));

  NAPI_CALL(env, napi_add_env_cleanup_hook(env, addon_destroy, NULL));
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
