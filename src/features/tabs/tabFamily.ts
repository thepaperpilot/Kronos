import {
    CoercableComponent,
    Component,
    GatherProps,
    getUniqueID,
    Replace,
    setDefault,
    StyleValue,
    Visibility
} from "features/feature";
import TabButtonComponent from "features/tabs/TabButton.vue";
import TabFamilyComponent from "features/tabs/TabFamily.vue";
import { Persistent, makePersistent, PersistentState } from "game/persistence";
import {
    Computable,
    GetComputableType,
    GetComputableTypeWithDefault,
    processComputable,
    ProcessedComputable
} from "util/computed";
import { createLazyProxy } from "util/proxies";
import { computed, Ref, unref } from "vue";
import { GenericTab } from "./tab";

export const TabButtonType = Symbol("TabButton");
export const TabFamilyType = Symbol("TabFamily");

export interface TabButtonOptions {
    visibility?: Computable<Visibility>;
    tab: Computable<GenericTab | CoercableComponent>;
    display: Computable<CoercableComponent>;
    classes?: Computable<Record<string, boolean>>;
    style?: Computable<StyleValue>;
    glowColor?: Computable<string>;
}

export interface BaseTabButton {
    type: typeof TabButtonType;
    [Component]: typeof TabButtonComponent;
}

export type TabButton<T extends TabButtonOptions> = Replace<
    T & BaseTabButton,
    {
        visibility: GetComputableTypeWithDefault<T["visibility"], Visibility.Visible>;
        tab: GetComputableType<T["tab"]>;
        display: GetComputableType<T["display"]>;
        classes: GetComputableType<T["classes"]>;
        style: GetComputableType<T["style"]>;
        glowColor: GetComputableType<T["glowColor"]>;
    }
>;

export type GenericTabButton = Replace<
    TabButton<TabButtonOptions>,
    {
        visibility: ProcessedComputable<Visibility>;
    }
>;

export interface TabFamilyOptions {
    visibility?: Computable<Visibility>;
    tabs: Record<string, TabButtonOptions>;
    classes?: Computable<Record<string, boolean>>;
    style?: Computable<StyleValue>;
}

export interface BaseTabFamily extends Persistent<string> {
    id: string;
    activeTab: Ref<GenericTab | CoercableComponent | null>;
    selected: Ref<string>;
    type: typeof TabFamilyType;
    [Component]: typeof TabFamilyComponent;
    [GatherProps]: () => Record<string, unknown>;
}

export type TabFamily<T extends TabFamilyOptions> = Replace<
    T & BaseTabFamily,
    {
        visibility: GetComputableTypeWithDefault<T["visibility"], Visibility.Visible>;
        tabs: Record<string, GenericTabButton>;
    }
>;

export type GenericTabFamily = Replace<
    TabFamily<TabFamilyOptions>,
    {
        visibility: ProcessedComputable<Visibility>;
    }
>;

export function createTabFamily<T extends TabFamilyOptions>(
    optionsFunc: () => T & ThisType<TabFamily<T>>
): TabFamily<T> {
    return createLazyProxy(() => {
        const tabFamily: T & Partial<BaseTabFamily> = optionsFunc();

        if (Object.keys(tabFamily.tabs).length === 0) {
            console.warn("Cannot create tab family with 0 tabs", tabFamily);
            throw "Cannot create tab family with 0 tabs";
        }

        tabFamily.id = getUniqueID("tabFamily-");
        tabFamily.type = TabFamilyType;
        tabFamily[Component] = TabFamilyComponent;

        makePersistent<string>(tabFamily, Object.keys(tabFamily.tabs)[0]);
        tabFamily.selected = tabFamily[PersistentState];
        tabFamily.activeTab = computed(() => {
            const tabs = unref(processedTabFamily.tabs);
            if (
                tabFamily[PersistentState].value in tabs &&
                unref(tabs[processedTabFamily[PersistentState].value].visibility) ===
                    Visibility.Visible
            ) {
                return unref(tabs[processedTabFamily[PersistentState].value].tab);
            }
            const firstTab = Object.values(tabs).find(
                tab => unref(tab.visibility) === Visibility.Visible
            );
            if (firstTab) {
                return unref(firstTab.tab);
            }
            return null;
        });

        processComputable(tabFamily as T, "visibility");
        setDefault(tabFamily, "visibility", Visibility.Visible);
        processComputable(tabFamily as T, "classes");
        processComputable(tabFamily as T, "style");

        for (const tab in tabFamily.tabs) {
            const tabButton: TabButtonOptions & Partial<BaseTabButton> = tabFamily.tabs[tab];
            tabButton.type = TabButtonType;
            tabButton[Component] = TabButtonComponent;

            processComputable(tabButton as TabButtonOptions, "visibility");
            setDefault(tabButton, "visibility", Visibility.Visible);
            processComputable(tabButton as TabButtonOptions, "tab");
            processComputable(tabButton as TabButtonOptions, "display");
            processComputable(tabButton as TabButtonOptions, "classes");
            processComputable(tabButton as TabButtonOptions, "style");
            processComputable(tabButton as TabButtonOptions, "glowColor");
        }

        tabFamily[GatherProps] = function (this: GenericTabFamily) {
            const { visibility, activeTab, selected, tabs, style, classes } = this;
            return { visibility, activeTab, selected, tabs, style: unref(style), classes };
        };

        // This is necessary because board.types is different from T and TabFamily
        const processedTabFamily = tabFamily as unknown as TabFamily<T>;
        return processedTabFamily;
    });
}
