import {
    Component,
    OptionsFunc,
    GatherProps,
    getUniqueID,
    Replace,
    setDefault,
    StyleValue,
    Visibility,
    CoercableComponent,
    isVisible,
    GenericComponent
} from "features/feature";
import JobComponent from "features/job/Job.vue";
import { createResource, Resource } from "features/resources/resource";
import { Persistent, persistent } from "game/persistence";
import player from "game/player";
import Decimal, { DecimalSource } from "util/bignum";
import {
    Computable,
    GetComputableType,
    GetComputableTypeWithDefault,
    processComputable,
    ProcessedComputable
} from "util/computed";
import { createLazyProxy } from "util/proxies";
import { computed, nextTick, ref, Ref, unref } from "vue";
import type { ToastID } from "vue-toastification/dist/types/types";

export const JobType = Symbol("Job");
export const levelSoftcapPower = 0.7643; // chosen so that e308 = level 100

declare module "@vue/runtime-dom" {
    interface CSSProperties {
        "--posx"?: string;
        "--posy"?: string;
        "--progress"?: string;
    }
}

export interface JobOptions {
    visibility?: Computable<Visibility | boolean>;
    classes?: Computable<Record<string, boolean>>;
    style?: Computable<StyleValue>;
    color: Computable<string>;
    image: Computable<string>;
    symbol: string;
    imageFocus: Computable<{ x: string; y: string }>;
    resource?: Resource | Resource[];
    randomQuips?: Computable<string[]>;
    layerID: string;
    modifierInfo?: Computable<CoercableComponent>;
    modifierModalAttrs?: Record<string, unknown>;
    showNotif?: Computable<boolean>;
    loopable?: Computable<boolean>;
}

export interface BaseJob {
    id: string;
    name: string;
    xp: Resource;
    rawLevel: Ref<DecimalSource>;
    level: Resource;
    levelProgress: Ref<number>;
    timeLoopActive: Persistent<boolean>;
    active: Ref<boolean>;
    currentQuip: Ref<string | null>;
    setQuip: (quip?: string) => void;
    notif?: ToastID;
    open: VoidFunction;
    type: typeof JobType;
    [Component]: GenericComponent;
    [GatherProps]: () => Record<string, unknown>;
}

export type Job<T extends JobOptions> = Replace<
    T & BaseJob,
    {
        visibility: GetComputableTypeWithDefault<T["visibility"], Visibility.Visible>;
        classes: GetComputableType<T["classes"]>;
        style: GetComputableType<T["style"]>;
        color: GetComputableType<T["color"]>;
        image: GetComputableType<T["image"]>;
        imageFocus: GetComputableType<T["imageFocus"]>;
        randomQuips: GetComputableType<T["randomQuips"]>;
    }
>;

export type GenericJob = Replace<
    Job<JobOptions>,
    {
        visibility: ProcessedComputable<Visibility | boolean>;
    }
>;

export function createJob<T extends JobOptions>(
    name: string,
    optionsFunc: OptionsFunc<T, BaseJob, GenericJob>
): Job<T> {
    const xp = createResource<DecimalSource>(0, name + " XP");
    const timeLoopActive = persistent<boolean>(false);
    return createLazyProxy(feature => {
        const job = optionsFunc.call(feature, feature);
        job.id = getUniqueID("job-");
        job.type = JobType;
        job[Component] = JobComponent as GenericComponent;

        job.name = name;
        job.xp = xp;
        job.timeLoopActive = timeLoopActive;
        job.rawLevel = computed(() => {
            const genericJob = job as GenericJob;
            if (Decimal.eq(genericJob.xp.value, 0)) {
                return 1;
            }
            let baseLevel = Decimal.clampMin(genericJob.xp.value, 1).log10().add(1);
            if (baseLevel.gt(25)) {
                baseLevel = baseLevel.sub(25).pow(levelSoftcapPower).add(25);
            }
            return baseLevel.floor();
        });
        job.level = createResource<DecimalSource>(
            computed(() => (job as GenericJob).rawLevel.value),
            job.name + " Levels"
        );
        job.levelProgress = computed(() => {
            const genericJob = job as GenericJob;
            const level = genericJob.rawLevel.value;

            const prevRequirement = getXPRequirement(level);
            const nextRequirement = getXPRequirement(Decimal.add(level, 1));

            let progress;
            if (Decimal.lt(level, 25)) {
                // Linear
                progress = Decimal.sub(genericJob.xp.value, prevRequirement)
                    .div(Decimal.sub(nextRequirement, prevRequirement))
                    .toNumber();
            } else {
                // Logarithmic
                progress = Decimal.log10(genericJob.xp.value)
                    .sub(Decimal.log10(prevRequirement))
                    .div(Decimal.log10(nextRequirement).sub(Decimal.log10(prevRequirement)))
                    .toNumber();
            }
            return progress;
        });
        job.active = computed(
            () =>
                isVisible((job as GenericJob).visibility) &&
                ((job as GenericJob).timeLoopActive.value || player.tabs[1] === job.layerID)
        );
        job.currentQuip = ref(null);

        setDefault(job as GenericJob, "open", function () {
            player.tabs.splice(1, 1, job.layerID);
        });

        job.setQuip = function (quip?: string) {
            const genericJob = job as GenericJob;
            if (genericJob.currentQuip.value != null) {
                genericJob.currentQuip.value = null;
                nextTick(genericJob.setQuip);
                return;
            }

            if (quip != null) {
                genericJob.currentQuip.value = quip;
            } else if (unref(genericJob.randomQuips)) {
                const quips = unref(genericJob.randomQuips) as string[];
                genericJob.currentQuip.value = quips[Math.floor(Math.random() * quips.length)];
            }
        };

        processComputable(job as T, "visibility");
        setDefault(job, "visibility", Visibility.Visible);
        processComputable(job as T, "classes");
        processComputable(job as T, "style");
        processComputable(job as T, "color");
        processComputable(job as T, "image");
        processComputable(job as T, "imageFocus");
        processComputable(job as T, "randomQuips");
        processComputable(job as T, "modifierInfo");
        processComputable(job as T, "showNotif");
        processComputable(job as T, "loopable");

        job[GatherProps] = function (this: GenericJob) {
            const {
                id,
                xp,
                level,
                levelProgress,
                timeLoopActive,
                name,
                visibility,
                color,
                image,
                imageFocus,
                resource,
                layerID,
                classes,
                style,
                currentQuip,
                randomQuips,
                modifierInfo,
                modifierModalAttrs,
                showNotif,
                loopable,
                open
            } = this;
            return {
                id,
                xp,
                level,
                levelProgress,
                timeLoopActive,
                name,
                visibility,
                color,
                image,
                imageFocus,
                resource,
                layerID,
                classes,
                style: unref(style),
                currentQuip,
                randomQuips,
                modifierInfo,
                modifierModalAttrs,
                showNotif,
                loopable,
                open
            };
        };

        return job as unknown as Job<T>;
    });
}

function getXPRequirement(level: DecimalSource): DecimalSource {
    if (Decimal.eq(level, 1)) {
        return 0;
    }
    if (Decimal.gt(level, 25)) {
        level = Decimal.sub(level, 25)
            .pow(1 / levelSoftcapPower)
            .add(25);
    }
    return Decimal.sub(level, 1).pow10();
}
