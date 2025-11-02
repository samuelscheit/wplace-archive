#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct {
  uint16_t dx;
  uint16_t dy;
  uint8_t rgba[4];
} sample_pixel_t;

typedef struct {
  uint16_t *dx;   // array of x offsets
  uint16_t *dy;   // array of y offsets
  uint32_t *rgba; // array of packed RGBA pixels as uint32_t
  size_t pixel_count;
  uint32_t width;
  uint32_t height;
  uint32_t channels;
  uint16_t first_pixel_dx;
  uint16_t first_pixel_dy;
} pumpkin_t;

void pumpkin_destroy(pumpkin_t *p);
bool pumpkin_init(pumpkin_t *p, const uint8_t *rgba, uint32_t width,
                  uint32_t height, uint32_t channels);
bool pumpkin_find(const pumpkin_t *p, const uint8_t *search,
                  uint32_t search_width, uint32_t search_height,
                  uint32_t channels, uint32_t *out_x, uint32_t *out_y);
