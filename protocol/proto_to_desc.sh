#!/bin/sh

# Convert the proto to the desc needed by protobuf node
protoc --descriptor_set_out=svmp.desc --include_imports svmp.proto