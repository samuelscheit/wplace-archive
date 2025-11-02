CC = cc
CFLAGS = -Wall -Wextra -O2 -std=c11
LDLIBS = -lm
TARGET = test_pumpkin

OBJS = test_pumpkin.o pumpkin_core.o

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ $(LDLIBS)

test_pumpkin.o: test_pumpkin.c pumpkin_core.h stb_image.h
	$(CC) $(CFLAGS) -c test_pumpkin.c -o test_pumpkin.o

pumpkin_core.o: pumpkin_core.c pumpkin_core.h
	$(CC) $(CFLAGS) -c pumpkin_core.c -o pumpkin_core.o

clean:
	rm -f $(TARGET) $(OBJS)
