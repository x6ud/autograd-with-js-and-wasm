import {createRouter, createWebHashHistory} from 'vue-router';

const router = createRouter({
    history: createWebHashHistory(process.env.BASE_URL),
    routes: [
        {
            path: '/',
            redirect: '/example/linear-regression'
        },
        {
            path: '/example/linear-regression',
            component: () => import('./example/linear-regression/LinearRegression.vue')
        },
        {
            path: '/example/classify',
            component: () => import('./example/classify/Classify.vue')
        },
        {
            path: '/example/cart-pole',
            component: () => import('./example/cart-pole/CartPole.vue')
        }
    ]
});

export default router;
