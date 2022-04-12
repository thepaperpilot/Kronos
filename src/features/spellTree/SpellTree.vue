<template>
    <div class="spell-tree-container">
        <div class="spell-tree" />
        <component :is="treeComponent" />
        <component :is="clickableComponent" />
        <svg style="display: none">
            <filter id="skilltreeturbulence">
                <feTurbulence
                    x="-50vw"
                    y="-50vh"
                    width="200vw"
                    height="200vh"
                    baseFrequency="0.015"
                    numOctaves="10"
                    seed="2"
                ></feTurbulence>
                <feDisplacementMap in="SourceGraphic" scale="10">
                    <animate
                        attributeName="scale"
                        values="10;50;10"
                        dur="10s"
                        repeatCount="indefinite"
                    />
                </feDisplacementMap>
            </filter>
        </svg>
    </div>
</template>

<script setup lang="tsx">
import "components/common/features.css";
import { GenericSpellTreeNode, Spell } from "data/flowers/layer";
import { createClickable } from "features/clickables/clickable";
import { render } from "util/vue";
import { Component, shallowRef, watchEffect } from "vue";

const props = defineProps<{
    spell: Spell<string>;
}>();

const treeComponent = shallowRef<Component | string>("");

watchEffect(() => {
    treeComponent.value = render(props.spell.tree);
});

const clickable = createClickable(() => ({
    display: "reset",
    classes: { "reset-tree": true },
    onClick() {
        Object.values(props.spell.treeNodes).forEach(
            n => ((n as GenericSpellTreeNode).bought.value = false)
        );
        props.spell.castingTime.value = 0;
    }
}));
const clickableComponent = render(clickable);
</script>

<style scoped>
.spell-tree-container {
    max-width: 600px;
    background: var(--raised-background);
    border-radius: var(--border-radius);
    position: relative;
    box-shadow: black 0 0 4px 0px;
    margin-top: 50px;
    overflow: hidden;
}

/*
.spell-tree-container::after {
    content: url(/public/android-chrome-512x512.png);
    -webkit-clip-path: inset(2px 44px 47px 2px);
    clip-path: inset(2px 44px 47px 2px);
    position: absolute;
    bottom: -128px;
    left: 200px;
    opacity: 0.25;
}
*/

.spell-tree-container > :deep(svg) {
    z-index: 0;
}

.spell-tree-container > :deep(.row) {
    margin: 20px auto;
}

.spell-tree {
    position: absolute;
    width: calc(100% + 100px);
    height: calc(100% + 100px);
    box-shadow: inset #b949de 0 0 80px 20px;
    filter: url(#skilltreeturbulence);
    transform: translate(-50px, -50px);
}

:deep(.reset-tree) {
    position: absolute !important;
    top: 10px;
    right: 10px;
    width: 50px !important;
    min-height: 20px !important;
    box-shadow: inset black 0 0 20px;
    --layer-color: var(--danger);
}

:deep(.reset-tree):hover {
    transform: none;
    box-shadow: inset black 0 0 0px, 0 0 20px #b949de;
}
</style>
