#!/bin/sh

NODE_CMD=`which node`
ACTION=""
PORT=8000
LOG='server.log'
PID_FILE='PID'

usage() {
    echo ""
    if [ $1 ]; then
        echo "Invalid argument $1"
    fi
    echo "server_control.sh [--help] [start] [stop] [restart] [--port 8000] [--log server.log] [--dev]"
    echo ""
    exit 1
}
start() {
    if [ -f $PID_FILE ]; then
        echo "server appears to already be running."
    else
        if [ -f $LOG ]; then
            mv $LOG ${LOG}.prev
        fi
        cmd="${NODE_CMD} server.js --port=${PORT} --log=${LOG}"
        if [ $DEV ]; then
            cmd="${cmd} --dev"
        fi
        $cmd &
        echo $! > $PID_FILE
    fi
}
stop() {
    if [ -f $PID_FILE ]; then
        pid=`cat $PID_FILE`
        kill $pid
        sleep 1
        rm $PID_FILE
    fi
}
while [ "$1" ]; do
    case $1 in
        --help) usage
                ;;
        start) ACTION="start"
               ;;
        stop) ACTION="stop"
              ;;
        restart) ACTION="restart"
                 ;;
        --port)
            shift
            if [ ! $1 ]; then
                echo "--port missing port number."
                usage
            fi
            PORT=$1
            ;;
        --log)
            shift
            if [ ! $1 ]; then
                echo "--log missing log file."
                usage
            fi
            LOG=$1
            ;;
        --dev)
            DEV=1
            ;;
        *) usage $1
           ;;
    esac
    shift
done

case $ACTION in
    start) start
           ;;
    stop) stop
          ;;
    restart) stop
             start
             ;;
    *) usage
       ;;
esac