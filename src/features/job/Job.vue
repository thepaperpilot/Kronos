<template>
    <span
        v-if="unref(visibility) !== Visibility.None"
        :style="[
            {
                visibility: unref(visibility) === Visibility.Hidden ? 'hidden' : undefined,
                '--posx': unref(imageFocus).x,
                '--posy': unref(imageFocus).y,
                '--progress': `${(1 - unref(levelProgress)) * 100}%`,
                '--foreground': unref(color)
            },
            unref(style) ?? {}
        ]"
        class="feature dontMerge job"
        :class="{
            selected,
            active: selected || unref(timeLoopActive),
            animating
        }"
        @click="openJob"
    >
        <img :src="unref(image)" />
        <div class="job-contents">
            <div class="job-resource" v-for="(resource, index) in resourceArray" :key="index">
                {{ displayResource(resource) }} {{ resource.displayName }}
            </div>
            <div class="job-title">
                <h2>{{ name }}</h2>
                <span style="margin-bottom: 2px">Lv. {{ formatWhole(level.value) }}</span>
                <span style="flex-grow: 1" />
                <ModifierInfo
                    v-if="modifierInfo"
                    :display="modifierInfo"
                    :name="name"
                    v-bind="modifierModalAttrs"
                />
            </div>
        </div>
        <div v-if="selected && unref(currentQuip)" class="job-quip">"{{ unref(currentQuip) }}"</div>
        <div class="job-progress-container">
            <div class="job-progress"></div>
        </div>
        <Tooltip :direction="Direction.Left" display="Toggle Time Loop" class="job-loop-toggle">
            <button
                class="material-icons"
                @click.stop="timeLoopActive.value = !unref(timeLoopActive)"
                v-if="finishedFirstChapter"
                :class="{
                    active: unref(timeLoopActive)
                }"
                :disabled="!hasTimeSlotAvailable && !unref(timeLoopActive)"
            >
                all_inclusive
            </button>
        </Tooltip>
        <Node :id="id" />
    </span>
</template>

<script lang="tsx">
import "components/common/features.css";
import Node from "components/Node.vue";
import { main } from "data/projEntry";
import { CoercableComponent, StyleValue, Visibility } from "features/feature";
import ModifierInfo from "features/ModifierInfo.vue";
import { displayResource, Resource } from "features/resources/resource";
import Tooltip from "features/tooltips/Tooltip.vue";
import { Persistent } from "game/persistence";
import player from "game/player";
import { formatWhole } from "util/bignum";
import { Direction } from "util/common";
import { processedPropType, unwrapRef } from "util/vue";
import {
    computed,
    ComputedRef,
    defineComponent,
    onUnmounted,
    PropType,
    ref,
    Ref,
    toRefs,
    unref,
    watch,
    watchEffect
} from "vue";

export default defineComponent({
    props: {
        visibility: {
            type: processedPropType<Visibility>(Number),
            required: true
        },
        style: processedPropType<StyleValue>(String, Object, Array),
        classes: processedPropType<Record<string, boolean>>(Object),
        xp: {
            type: Object as PropType<Resource>,
            required: true
        },
        level: {
            type: Object as PropType<Resource>,
            required: true
        },
        levelProgress: {
            type: Object as PropType<Ref<number>>,
            required: true
        },
        timeLoopActive: {
            type: Object as PropType<Persistent<boolean>>,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        color: {
            type: processedPropType<string>(String),
            required: true
        },
        image: {
            type: processedPropType<string>(String),
            required: true
        },
        imageFocus: {
            type: processedPropType<{ x: string; y: string }>(Object),
            required: true
        },
        resource: [Object, Array] as PropType<Resource | Resource[]>,
        layerID: {
            type: String,
            required: true
        },
        currentQuip: {
            type: Object as PropType<Ref<string | null>>,
            required: true
        },
        randomQuips: {
            type: processedPropType<string[]>(Array),
            required: true
        },
        modifierInfo: processedPropType<CoercableComponent>(String, Object, Function),
        id: {
            type: String,
            required: true
        },
        modifierModalAttrs: Object as PropType<Record<string, unknown>>
    },
    components: {
        Node,
        ModifierInfo,
        Tooltip
    },
    setup(props) {
        const { layerID, currentQuip, randomQuips, resource } = toRefs(props);

        const selected = computed(() => player.tabs[1] == layerID.value);
        const finishedFirstChapter: ComputedRef<boolean> = computed(() => main.chapter.value > 1);
        const hasTimeSlotAvailable: ComputedRef<boolean> = main.hasTimeSlotAvailable;

        function openJob() {
            player.tabs.splice(1, 1, layerID.value);
        }

        let quipTimer: number | undefined = undefined;
        watchEffect(() => {
            clearInterval(quipTimer);
            const quips = unwrapRef(randomQuips);
            if (currentQuip.value) {
                quipTimer = setTimeout(() => {
                    currentQuip.value = null;
                }, 15000);
            } else {
                quipTimer = setTimeout(() => {
                    currentQuip.value = quips[Math.floor(Math.random() * quips.length)];
                }, Math.random() * 15000 + 15000);
            }
        });
        onUnmounted(() => clearInterval(quipTimer));

        const animating = ref<boolean>(false);
        watch(selected, () => {
            animating.value = true;
            setTimeout(() => (animating.value = false), 250);
        });

        const resourceArray = computed(() => {
            if ("displayName" in resource) {
                return [resource] as unknown as Resource[];
            }
            const currResource = unref(resource);
            if (Array.isArray(currResource)) {
                return currResource as unknown as Resource[];
            }
            return [];
        });

        return {
            selected,
            animating,
            finishedFirstChapter,
            hasTimeSlotAvailable,
            formatWhole,
            openJob,
            unref,
            displayResource,
            resourceArray,
            Visibility,
            Direction
        };
    }
});
</script>

<style scoped>
.job {
    height: 104px;
    width: 516px;
    position: relative;
    background: var(--raised-background);
    overflow: hidden;
    box-shadow: 0 4px 4px 0 rgb(0 0 0 / 25%);
}

.job:not(.selected) {
    border-bottom-left-radius: 50px;
    border-top-left-radius: 50px;
    cursor: pointer;
}

.job:not(.selected):hover {
    box-shadow: 0 0 12px var(--foreground);
}

.job > img {
    position: absolute;
    top: 0;
    left: 0;
    clip-path: circle(100% at 50% 50%);
    z-index: 1;
}

.job:not(.selected),
.job:not(.selected) > * {
    transition: all 0.5s 0.25s, box-shadow 0.5s 0s, clip-path 0s 0s;
}

.job:not(.selected) > img {
    clip-path: circle(51px at var(--posx) var(--posy));
    transform: translate(calc(-1 * var(--posx) + 50px), calc(-1 * var(--posy) + 50px));
    transition: all 0.5s 0.25s, clip-path 0.5s 0s;
}

.job.selected > img {
    height: 288px;
    width: 512px;
    border-radius: var(--border-radius);
    transition: all 0.5s, clip-path 0.5s 0.25s ease-in-out;
}

.job.active {
    border-color: var(--bought);
}

.job.selected {
    height: 314px;
}

.job-loop-toggle {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
}

.job-loop-toggle button {
    color: var(--background);
    border: none;
    padding: 0;
    margin: 10px;
    background: var(--foreground);
    border-radius: 50%;
}

.job-loop-toggle button.active {
    color: var(--link);
    box-shadow: 0 0 8px 4px var(--link);
}

.job-loop-toggle button:not([disabled]):hover {
    box-shadow: 0 0 12px var(--points);
    cursor: pointer;
}

.job-contents {
    position: absolute;
    top: calc(100% - 30px);
    left: 110px;
    right: 10px;
    transform: translateY(-100%);
    z-index: 1;
    text-align: left;
}

.job.selected > .job-contents {
    left: 10px;
}

.job-title {
    margin: 0;
    color: var(--foreground);
    width: 100%;
    text-align: left;
    display: flex;
}

.job-title h2 {
    margin-right: 10px;
}

.job-resource {
    color: var(--foreground);
    display: inline-block;
}

.job-resource + .job-resource::before {
    content: ", ";
}

.job-progress-container {
    position: absolute;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border: 2px solid var(--foreground);
    border-bottom-right-radius: var(--border-radius);
    height: 20px;
}

.job.selected > .job-progress-container {
    left: -2px;
    border-bottom-left-radius: var(--border-radius);
}

.job-progress {
    width: 100%;
    height: 100%;
    background-color: var(--foreground);
    clip-path: inset(0% calc(var(--progress) * (0.88) + 0px) 0% 0%);
    transition: clip-path 0s 0s;
}

.job.selected .job-progress {
    clip-path: inset(0% calc(var(--progress)) 0% 0%);
}

.animating .job-progress {
    transition: clip-path 0.2s 0s;
}

.job-quip {
    position: absolute;
    z-index: 5;
    background: var(--locked);
    border: 2px solid rgba(0, 0, 0, 0.125);
    padding: 5px;
    top: 20px;
    left: 50%;
    transform: translate(-50%);
    color: var(--feature-foreground);
    max-width: 400px;
    font-style: italic;
    pointer-events: none;
    animation: quipAnimation 15s;
    animation-fill-mode: forwards;
}

@keyframes quipAnimation {
    0% {
        opacity: 0;
    }
    5% {
        opacity: 1;
    }
    80% {
        opacity: 1;
    }
    100% {
        opacity: 0;
    }
}
</style>
