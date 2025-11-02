#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "pumpkin_core.h"

static uint8_t *load_image_rgba(const char *path, int *w, int *h, int *c) {
  uint8_t *data = stbi_load(path, w, h, c, 4);
  if (!data) {
    fprintf(stderr, "Failed to load image: %s\n", path);
    return NULL;
  }
  *c = 4;
  return data;
}

int main(void) {
  const char *pumpkin_path = "../pumpkin/pumpkin.png";
  const char *search_path = "../pumpkin/search.png";

  int pw, ph, pc;
  int sw, sh, sc;

  uint8_t *pumpkin_img = load_image_rgba(pumpkin_path, &pw, &ph, &pc);
  if (!pumpkin_img)
    return 1;

  uint8_t *search_img = load_image_rgba(search_path, &sw, &sh, &sc);
  if (!search_img) {
    stbi_image_free(pumpkin_img);
    return 1;
  }

  printf("Loaded pumpkin: %dx%d (%d channels)\n", pw, ph, pc);
  printf("Loaded search:  %dx%d (%d channels)\n", sw, sh, sc);

  pumpkin_t p = {0};

  if (!pumpkin_init(&p, pumpkin_img, pw, ph, pc)) {
    fprintf(stderr, "pumpkin_init() failed\n");
    goto cleanup;
  }

  uint32_t fx = 0, fy = 0;
  bool found = pumpkin_find(&p, search_img, sw, sh, sc, &fx, &fy);

  if (found) {
    printf("Pumpkin found at: (%u, %u)\n", fx, fy);
  } else {
    printf("Pumpkin not found in search image.\n");
  }

cleanup:
  pumpkin_destroy(&p);
  stbi_image_free(pumpkin_img);
  stbi_image_free(search_img);
  return 0;
}
