<template>
    <div class="container">
        <canvas ref="canvas"></canvas>
        <div class="text">
            SCORE: {{ score }}
        </div>
    </div>
</template>

<script lang="ts" src="./CartPole.ts"></script>

<style lang="scss" scoped>
.container {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    background: #f2f2f2;

    canvas {
        margin: auto;
    }

    .text {
        position: absolute;
        left: 8px;
        top: 8px;
    }
}
</style>