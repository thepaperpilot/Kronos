<template>
    <span class="material-icons-outlined modifier-info-toggle" @click="openModal = true">help</span>
    <Modal v-model="openModal" class="modifiers-modal">
        <template v-slot:header
            ><h2>{{ name }} Modifiers</h2></template
        >
        <template v-slot:body="{ shown }"><component v-if="shown" :is="comp" /></template>
    </Modal>
</template>

<script setup lang="ts">
import Modal from "../components/Modal.vue";
import { ProcessedComputable } from "util/computed";
import {
    Component,
    onBeforeUnmount,
    ref,
    shallowRef,
    toRef,
    watch,
    watchEffect,
    WatchStopHandle
} from "vue";
import { coerceComponent, unwrapRef } from "util/vue";
import { CoercableComponent } from "./feature";

const props = defineProps<{
    display: ProcessedComputable<CoercableComponent>;
    name: string;
}>();
const display = toRef(props, "display");

const openModal = ref<boolean>(false);

const comp = shallowRef<Component | "">();
let watcher: WatchStopHandle | null = null;

watch(openModal, isOpen => {
    watcher?.();
    if (isOpen) {
        watcher = watchEffect(() => {
            comp.value = coerceComponent(unwrapRef(display));
        });
    } else {
        watcher = null;
    }
});

onBeforeUnmount(() => watcher?.());
</script>

<style scoped>
.modifier-info-toggle {
    cursor: pointer;
}
</style>

<style>
.modifiers-modal .modal-container {
    width: 720px;
}
</style>
