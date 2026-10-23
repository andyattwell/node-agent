#!/bin/bash

export GGML_CUDA_FORCE_MMQ=1

# Get from args
BINARY_NAME="llama-server"
CLI=$1
if [ "$CLI" == "cli" ]; then
    echo "Starting llama-cli..."
    BINARY_NAME="llama-cli"
else
    echo "Starting llama-server..."
fi

SCRIPT_DIR=$(dirname "$0")
LLAMA_CPP_PATH=$(realpath $SCRIPT_DIR/../../llama.cpp/build-cuda/bin/$BINARY_NAME) # resolve absolute path
MODELS_DIR=$(realpath $SCRIPT_DIR/../../llama-models)

# qwen3-5-2B-Q4_K_M google_gemma-4-E2B-it-Q6_K_L
SELECTED_MODEL=gemma-3n-e4b-it-q4_k_m-imat
LLAMA_MODEL_PATH=$(realpath $MODELS_DIR/$SELECTED_MODEL.gguf) # resolve absolute
JINJA_TEMPLATE_PATH=$(realpath $SCRIPT_DIR/../llama/qwen3-chat-template-patched.jinja) # resolve absolute

# Check if both paths are set and are valid
if [[ -n "$LLAMA_CPP_PATH" && -n "$LLAMA_MODEL_PATH" ]]; then
    echo "Starting $BINARY_NAME..."
    echo "LLAMA_CPP_PATH: $LLAMA_CPP_PATH"
    echo "LLAMA_MODEL_PATH: $LLAMA_MODEL_PATH"
    echo "JINJA_TEMPLATE_PATH: $JINJA_TEMPLATE_PATH"
else
    echo "LLAMA_CPP_PATH or LLAMA_MODEL_PATH is not set"
    exit 1
fi

HOST=127.0.0.1
PORT=8088
BATCH_SIZE=12982
UBATCH_SIZE=2191
THREADS=8
NGPU_LAYERS=13
CONTEXT_SIZE=16384
TEMPERATURE=0.8
TOP_P=0.95
TOP_K=40
REPEAT_PENALTY=1.05
REPEAT_LAST_N=128
KEEP=4096

ARGS="--jinja \
        --batch-size $BATCH_SIZE \
        --ubatch-size $UBATCH_SIZE \
        --threads $THREADS \
        --warmup \
        -c $CONTEXT_SIZE \
        --gpu-layers $NGPU_LAYERS \
        --chat-template-file $JINJA_TEMPLATE_PATH \
        --temperature $TEMPERATURE \
        --top_p $TOP_P \
        --top_k $TOP_K \
        --repeat_penalty $REPEAT_PENALTY \
        --repeat_last_n $REPEAT_LAST_N \
        --keep $KEEP \
        --reasoning-format auto"

if [ BINARY_NAME == "llama-server" ]; then
    ARGS+="--host $HOST --port $PORT --sleep-idle-seconds -1"
fi

$LLAMA_CPP_PATH -m $LLAMA_MODEL_PATH # $ARGS

# ./bin/llama-bench --batch-size 12982 --ubatch-size 2191 --threads 7 -ngl 12 --model /home/andy/Projects/llama-models/qwen3-5-2B-Q4_K_M.gguf -r 2 -o csv --no-warmup -n 192 -p 0a
# ./bin/llama-bench --model /home/andy/Projects/llama-models/qwen3-5-2B-Q4_K_M.gguf -n 128 -p 256 -r 6 --no-warmup --progress
