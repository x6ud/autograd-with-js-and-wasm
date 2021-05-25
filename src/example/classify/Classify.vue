<template>
    <div class="container">
        <canvas ref="canvas"></canvas>
        <div class="text">
            <div>TURN {{ turn }}</div>
            <div>LOSS = {{ loss }}</div>
        </div>
    </div>
</template>

<script lang="ts" src="./Classify.ts"></script>

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