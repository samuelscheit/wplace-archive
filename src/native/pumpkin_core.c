#include "pumpkin_core.h"
#include <stdlib.h>
#include <string.h>

void pumpkin_destroy(pumpkin_t *p) {
  if (!p)
    return;
  free(p->dx);
  free(p->dy);
  free(p->rgba);
  memset(p, 0, sizeof(*p));
}

bool pumpkin_init(pumpkin_t *p, const uint8_t *rgba, uint32_t width,
                  uint32_t height, uint32_t channels) {
  if (!p || !rgba || channels != 4 || width == 0 || height == 0)
    return false;

  pumpkin_destroy(p);

  size_t count = 0;
  bool first_found = false;
  uint16_t first_dx = 0, first_dy = 0;

  for (uint32_t y = 0; y < height; y++) {
    for (uint32_t x = 0; x < width; x++) {
      size_t idx = ((size_t)y * width + x) * channels;
      if (rgba[idx + 3] == 255) {
        if (!first_found) {
          first_dx = x;
          first_dy = y;
          first_found = true;
        }
        count++;
      }
    }
  }

  if (count == 0)
    return false;

  p->dx = malloc(sizeof(uint16_t) * count);
  p->dy = malloc(sizeof(uint16_t) * count);
  p->rgba = malloc(sizeof(uint32_t) * count);
  if (!p->dx || !p->dy || !p->rgba) {
    pumpkin_destroy(p);
    return false;
  }

  size_t w = 0;
  for (uint32_t y = 0; y < height; y++) {
    for (uint32_t x = 0; x < width; x++) {
      size_t idx = ((size_t)y * width + x) * channels;
      if (rgba[idx + 3] == 255) {
        p->dx[w] = x;
        p->dy[w] = y;
        p->rgba[w] = *(uint32_t *)&rgba[idx];
        w++;
      }
    }
  }

  p->pixel_count = count;
  p->width = width;
  p->height = height;
  p->channels = channels;
  p->first_pixel_dx = first_dx;
  p->first_pixel_dy = first_dy;

  return true;
}

bool pumpkin_find(const pumpkin_t *p, const uint8_t *search,
                  uint32_t search_width, uint32_t search_height,
                  uint32_t channels, uint32_t *out_x, uint32_t *out_y) {
  if (!p || !p->dx || !p->dy || !p->rgba || !search)
    return false;
  if (channels != 4 || search_width < p->width || search_height < p->height)
    return false;

  // Optimisations:
  // 1. skip bad candidates before doing full scan.
  // 2. merging rgba[4] into uint32_t results in very fast comparisons
  // 3. early return: skip rest on first mismatch
  // 4. do less work per loop
  // 5. compiler can autovectorize inner pixel loop

  uint32_t max_x = search_width - p->width;
  uint32_t max_y = search_height - p->height;

  // prefiltering condition
  uint32_t first_val = p->rgba[0];

  for (uint32_t sy = 0; sy <= max_y; sy++) {
    for (uint32_t sx = 0; sx <= max_x; sx++) {
      // apply prefilter
      size_t idx0 =
          ((size_t)sy + p->dy[0]) * search_width + ((size_t)sx + p->dx[0]);
      idx0 *= channels;

      // this treats rgba as a single 32bit integer
      uint32_t cand_val = *(uint32_t *)&search[idx0];
      // reject filtered out candidates
      if (cand_val != first_val) {
        continue;
      }

      bool matched = true;

      size_t i = 1;
#pragma GCC ivdep
      for (; i < p->pixel_count; i++) {
        size_t idx =
            ((size_t)sy + p->dy[i]) * search_width + ((size_t)sx + p->dx[i]);
        idx *= channels;

        // again treat rgba[4] as a single 32bit integer, its faster
        uint32_t search_val = *(uint32_t *)&search[idx];
        if (search_val != p->rgba[i]) {
          matched = false;
          break;
        }
      }

      if (matched) {
        if (out_x)
          *out_x = sx + p->first_pixel_dx;
        if (out_y)
          *out_y = sy + p->first_pixel_dy;
        return true;
      }
    }
  }

  return false;
}
