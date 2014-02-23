ifndef ROOT_DIR
	ROOT_DIR := ..
endif
CLIENT_BUILD_DIR := $(ROOT_DIR)/command-line/build

CLOSURE_FLAGS := \
	--compilation_level WHITESPACE_ONLY \
	--formatting PRETTY_PRINT

.DEFAULT_GOAL := all
#CONFIG_PATH := uploader/config.js

VPATH = $(ROOT_DIR)/client
include $(ROOT_DIR)/client/Makefile

all: client

.PHONY: all
