<template>
    <span
        v-if="unref(visibility) !== Visibility.None"
        :style="[
            {
                visibility: unref(visibility) === Visibility.Hidden ? 'hidden' : undefined,
                '--posx': unref(imageFocus).x,
                '--posy': unref(imageFocus).y,
                '--progress': `-${(1 - unref(levelProgress)) * 100}%`,
                '--foreground': unref(color)
            },
            unref(style) ?? {}
        ]"
        class="feature dontMerge job"
        :class="{
            selected,
            active: selected || unref(timeLoopActive)
        }"
        @click="openJob"
    >
        <img :src="unref(image)" />
        <div class="job-contents">
            <div class="job-resource" v-if="resource">
                {{ displayResource(resource) }} {{ resource.displayName }}
            </div>
            <div class="job-title">
                <h2>{{ name }}</h2>
                <span style="margin-bottom: 2px">Lv. {{ formatWhole(level.value) }}</span>
                <span style="flex-grow: 1" />
                <ModifierInfo :display="modifierInfo" :name="name" />
            </div>
        </div>
        <div v-if="selected && unref(currentQuip)" class="job-quip">"{{ unref(currentQuip) }}"</div>
        <div class="job-progress-container">
            <div class="job-progress"></div>
        </div>
        <button
            class="job-loop-toggle material-icons"
            @click.stop="toggleLoop"
            v-if="finishedFirstChapter"
            :class="{
                active: unref(timeLoopActive)
            }"
            :disabled="!hasTimeSlotAvailable"
        >
            loop
        </button>
        <Node :id="id" />
    </span>
</template>

<script lang="tsx">
import "components/common/features.css";
import Node from "components/Node.vue";
import ModifierInfo from "features/ModifierInfo.vue";
import { CoercableComponent, StyleValue, Visibility } from "features/feature";
import { displayResource, Resource } from "features/resources/resource";
import { Persistent } from "game/persistence";
import player from "game/player";
import { formatWhole } from "util/bignum";
import { processedPropType, unwrapRef } from "util/vue";
import {
    computed,
    defineComponent,
    onUnmounted,
    PropType,
    Ref,
    toRefs,
    unref,
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
        resource: Object as PropType<Resource>,
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
        modifierInfo: {
            type: processedPropType<CoercableComponent>(String, Object, Function),
            required: true
        },
        id: {
            type: String,
            required: true
        }
    },
    components: {
        Node,
        ModifierInfo
    },
    setup(props) {
        const { timeLoopActive, layerID, currentQuip, randomQuips } = toRefs(props);

        const selected = computed(() => player.tabs.includes(layerID.value));
        const finishedFirstChapter = computed(() => player.layers.main.chapter !== 1);

        function openJob() {
            player.tabs.splice(1, 1, layerID.value);
        }

        function toggleLoop() {
            timeLoopActive.value = !timeLoopActive.value;
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

        return {
            selected,
            finishedFirstChapter,
            hasTimeSlotAvailable: player.layers.main.hasTimeSlotAvailable as Ref<boolean>,
            formatWhole,
            openJob,
            toggleLoop,
            unref,
            displayResource,
            Visibility
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
.job:not(.selected) * {
    transition: all 0.5s 0.25s, box-shadow 0.5s 0s;
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
    color: var(--background);
    font-weight: bolder;
    background: none;
    border: none;
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
}

.job-loop-toggle.active {
    color: var(--link);
}

.job-loop-toggle:not([disabled]):hover {
    text-shadow: 0 0 12px var(--points) !important;
    cursor: pointer;
}

.job-contents {
    position: absolute;
    top: calc(100% - 30px);
    left: 110px;
    right: 10px;
    transform: translateY(-100%);
    z-index: 1;
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
    margin: 0;
    color: var(--foreground);
    width: 100%;
    text-align: left;
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
    clip-path: inset(0% calc(-1 * var(--progress) - 50px) 0% 0%);
    transition-duration: 0s;
}

.job.selected .job-progress {
    clip-path: inset(0% calc(-1 * var(--progress)) 0% 0%);
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
