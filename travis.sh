#!/bin/sh

# Make grunt run all the tests, even if some fail
# Record the output
grunt --force test:sauce:parallel | tee grunt_output

# Check output for error warnings
! grep 'Used --force, continuing.' grunt_output > /dev/null
