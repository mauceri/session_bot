#!/bin/bash

export HOST_IP=$(ip route get 1.1.1.1 | awk '{print $3}')
docker compose up -d
