<template>
    <div class="container">
        <div class="links">
            <span>Examples:</span>
            <router-link to="/example/linear-regression">Linear Regression</router-link>
            <router-link to="/example/classify">Classify</router-link>
            <router-link to="/example/cart-pole">Cart Pole</router-link>
        </div>
        <div class="view">
            <router-view/>
        </div>
    </div>
</template>

<style lang="css">
html {
    width: 100%;
    height: 100%;
}

body {
    width: 100%;
    height: 100%;
    margin: 0;
}

#app {
    width: 100%;
    height: 100%;
    font-size: 14px;
}
</style>

<style lang="scss" scoped>
.container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;

    & > .links {
        padding: 4px 8px;

        & > * {
            margin-right: .5em;
        }
    }

    & > .view {
        position: relative;
        flex: 1 1;
        min-height: 0;
        overflow: auto;
    }
}
</style>