import { usePage } from '@inertiajs/react'
import { getPresetLabel, normalizeSettings } from '@/lib/modules'

export default function useModules(settingsOverride = null) {
    const { appSettings } = usePage().props
    const settings = normalizeSettings(settingsOverride ?? appSettings ?? {})
    const { business, modules, capabilities } = settings

    function isModuleEnabled(key) {
        return modules[key] !== false
    }

    function isCapabilityEnabled(key) {
        return capabilities[key] !== false
    }

    function isEnabled(key) {
        return Object.prototype.hasOwnProperty.call(modules, key)
            ? isModuleEnabled(key)
            : isCapabilityEnabled(key)
    }

    function isAnyEnabled(keys, scope = 'capabilities') {
        const source = scope === 'modules' ? modules : capabilities

        return keys.some((key) => source[key] !== false)
    }

    return {
        settings,
        business,
        modules,
        capabilities,
        preset: business?.preset,
        presetLabel: getPresetLabel(business?.preset),
        isEnabled,
        isAnyEnabled,
        isModuleEnabled,
        isCapabilityEnabled,
    }
}
