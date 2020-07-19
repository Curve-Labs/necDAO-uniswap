#!/usr/bin/env bash

# exit script as soon as a command fails
# set -o errexit

# execute cleanup function at script exit
# trap cleanup EXIT

# set ganache port
ganache_port=8545

# cleanup() {
#   # kill the ganache instance that we started [if we started one and if it's still running]
#   if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
#     kill -9 $ganache_pid
#   fi
# }

ganache_running() {
  nc -z localhost "$ganache_port" > /dev/null 2>&1
}

stop_ganache() {
  ganache_pid=$(lsof -t -i :8545)
  kill -9 $ganache_pid
}

# --fork https://mainnet.infura.io/v3/3fcbe43325d14fc6b31c35ef977c6dea 

start_ganache() {
  node_modules/.bin/ganache-cli --gasLimit 99900000  --port "$ganache_port" -m "myth like bonus scare over problem client lizard pioneer submit female collect" > /dev/null &

  ganache_pid=$!

  echo -n "[+] starting ganache on port "$ganache_port"..."

  while ! ganache_running; do
    sleep 0.1
  done

  printf "\b\b\b \e[32mOK\e[0m\n"
}

if [ "$1" == "test" ]; then
  start_ganache
  node_modules/.bin/truffle test
  # stop_ganache
elif [ "$1" == "stop" ]; then
  echo -n "[+] killing running ganache instances..."
  if ganache_running; then
    stop_ganache
  fi
  printf "\b\b\b \e[32mOK\e[0m\n"
elif ganache_running; then
  echo "[+] ganache already running on port "$ganache_port
else
  start_ganache
fi

# echo ""
# node_modules/.bin/truffle test