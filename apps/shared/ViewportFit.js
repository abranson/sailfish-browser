/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
    var Ci = Components.interfaces;

    var lastViewportFitState = null;
    var lastDocument = null;
    var lastSafeAreaInsetUsage = 0;
    var themeColorMutationObserver = null;
    var themeColorObserverTarget = null;
    var themeColorMediaListeners = [];

    function resetForCurrentDocument() {
        if (lastDocument !== content.document) {
            clearThemeColorObservers();
            lastDocument = content.document;
            lastSafeAreaInsetUsage = 0;
            lastViewportFitState = null;
            installThemeColorObservers();
        }
    }

    function windowUtils() {
        try {
            if (content.windowUtils) {
                return content.windowUtils;
            }
        } catch (e) {
        }

        try {
            return content.QueryInterface(Ci.nsIInterfaceRequestor)
                          .getInterface(Ci.nsIDOMWindowUtils);
        } catch (e) {
        }

        return null;
    }

    function topLevelContentEvent(event) {
        var target = event.originalTarget;
        return target === content.document || (target && target.ownerGlobal === content);
    }

    function viewportFitFromMeta() {
        var viewportFit = "auto";
        var metas = content.document.querySelectorAll("meta[name=viewport]");
        for (var i = 0; i < metas.length; ++i) {
            var match = /(?:^|[,;])\s*viewport-fit\s*=\s*(cover|contain)\b/i
                    .exec(metas[i].getAttribute("content") || "");
            if (match) {
                viewportFit = match[1].toLowerCase();
            }
        }
        return viewportFit;
    }

    function currentViewportFit() {
        try {
            var utils = windowUtils();
            if (utils) {
                var viewportFit = utils.getViewportFitInfo();
                if (viewportFit === "cover" || viewportFit === "contain") {
                    return viewportFit;
                }
            }
        } catch (e) {
        }

        try {
            return viewportFitFromMeta();
        } catch (e) {
        }

        return "auto";
    }

    function currentSafeAreaInsetUsage() {
        try {
            var utils = windowUtils();
            if (utils) {
                return utils.getSafeAreaInsetUsageInfo() >>> 0;
            }
        } catch (e) {
        }

        return lastSafeAreaInsetUsage;
    }

    function colorComponentValue(component) {
        component = String(component);
        var value = parseFloat(component);
        if (component.indexOf("%") >= 0) {
            value = value * 255 / 100;
        }

        return value;
    }

    function colorComponentToHex(value) {
        value = Math.max(0, Math.min(255, Math.round(value)));
        var hex = value.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }

    function alphaComponent(component) {
        if (component === undefined) {
            return 1;
        }

        var value = parseFloat(component);
        if (component.indexOf("%") >= 0) {
            value = value / 100;
        }

        if (isNaN(value)) {
            return 1;
        }

        return Math.max(0, Math.min(1, value));
    }

    function colorToHex(color) {
        var hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
        if (hexMatch) {
            if (hexMatch[1].length === 3) {
                return ("#" +
                        hexMatch[1][0] + hexMatch[1][0] +
                        hexMatch[1][1] + hexMatch[1][1] +
                        hexMatch[1][2] + hexMatch[1][2]).toLowerCase();
            }

            return color.toLowerCase();
        }

        var match = /^rgba?\(\s*([^)]+)\s*\)$/i.exec(color);
        if (!match) {
            return "";
        }

        var parts = match[1].split(/\s*,\s*/);
        if (parts.length < 3) {
            return "";
        }

        var alpha = alphaComponent(parts[3]);
        return "#" +
                colorComponentToHex(colorComponentValue(parts[0]) * alpha) +
                colorComponentToHex(colorComponentValue(parts[1]) * alpha) +
                colorComponentToHex(colorComponentValue(parts[2]) * alpha);
    }

    function normalizedThemeColor(color) {
        color = (color || "").trim();
        if (!color) {
            return "";
        }

        try {
            if (content.CSS && content.CSS.supports &&
                    !content.CSS.supports("color", color)) {
                return "";
            }
        } catch (e) {
        }

        try {
            var canvas = content.document.createElement("canvas");
            var context = canvas.getContext("2d");
            if (!context) {
                return "";
            }

            context.fillStyle = "#010203";
            context.fillStyle = color;
            var normalized = colorToHex(context.fillStyle);
            if (normalized === "#010203" && colorToHex(color) !== "#010203") {
                return "";
            }

            return normalized;
        } catch (e) {
        }

        return "";
    }

    function mediaMatches(media) {
        if (!media) {
            return false;
        }

        try {
            return content.matchMedia(media).matches;
        } catch (e) {
        }

        return false;
    }

    function currentThemeColor() {
        try {
            var fallback = "";
            var metas = content.document.querySelectorAll("meta[name]");
            for (var i = 0; i < metas.length; ++i) {
                if ((metas[i].getAttribute("name") || "").toLowerCase() !== "theme-color") {
                    continue;
                }

                var color = normalizedThemeColor(metas[i].getAttribute("content"));
                if (!color) {
                    continue;
                }

                var media = metas[i].getAttribute("media");
                if (media) {
                    if (mediaMatches(media)) {
                        return color;
                    }
                } else if (!fallback) {
                    fallback = color;
                }
            }

            return fallback;
        } catch (e) {
        }

        return "";
    }

    function themeColorChanged() {
        try {
            if (themeColorObserverTarget !== (content.document.head || content.document.documentElement)) {
                installThemeColorObservers();
            }
        } catch (e) {
        }
        notifyViewportFit(true);
    }

    function addThemeColorMediaListener(query) {
        try {
            var mediaQuery = content.matchMedia(query);
            var listener = themeColorChanged;
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", listener);
            } else {
                mediaQuery.addListener(listener);
            }
            themeColorMediaListeners.push({ mediaQuery: mediaQuery, listener: listener });
        } catch (e) {
        }
    }

    function clearThemeColorObservers() {
        if (themeColorMutationObserver) {
            try {
                themeColorMutationObserver.disconnect();
            } catch (e) {
            }
            themeColorMutationObserver = null;
            themeColorObserverTarget = null;
        }

        for (var i = 0; i < themeColorMediaListeners.length; ++i) {
            try {
                if (themeColorMediaListeners[i].mediaQuery.removeEventListener) {
                    themeColorMediaListeners[i].mediaQuery.removeEventListener(
                            "change", themeColorMediaListeners[i].listener);
                } else {
                    themeColorMediaListeners[i].mediaQuery.removeListener(
                            themeColorMediaListeners[i].listener);
                }
            } catch (e) {
            }
        }
        themeColorMediaListeners = [];
    }

    function installThemeColorObservers() {
        clearThemeColorObservers();

        try {
            var target = content.document.head || content.document.documentElement;
            if (target) {
                themeColorObserverTarget = target;
                themeColorMutationObserver = new content.MutationObserver(themeColorChanged);
                themeColorMutationObserver.observe(target, {
                    attributes: true,
                    attributeFilter: [ "content", "media", "name" ],
                    childList: true,
                    subtree: target === content.document.head
                });
            }
        } catch (e) {
        }

        addThemeColorMediaListener("(prefers-color-scheme: dark)");
        addThemeColorMediaListener("(prefers-color-scheme: light)");
    }

    function notifyViewportFit(force) {
        resetForCurrentDocument();

        var data = {
            viewportFit: currentViewportFit(),
            safeAreaInsetUsage: currentSafeAreaInsetUsage(),
            themeColor: currentThemeColor()
        };
        var state = data.viewportFit + ":" +
                    data.safeAreaInsetUsage + ":" +
                    data.themeColor;
        if (!force && state === lastViewportFitState) {
            return;
        }

        lastViewportFitState = state;
        sendAsyncMessage("embed:viewportfit", data);
    }

    function notifyViewportFitAfterStyle() {
        notifyViewportFit(true);
        try {
            content.requestAnimationFrame(function() {
                notifyViewportFit(true);
            });
        } catch (e) {
        }
        try {
            content.setTimeout(function() {
                notifyViewportFit(true);
            }, 250);
        } catch (e) {
        }
    }

    addEventListener("DOMMetaViewportFitChanged", function(event) {
        if (topLevelContentEvent(event)) {
            notifyViewportFit();
        }
    }, true);

    addEventListener("DOMSafeAreaInsetUsageChanged", function(event) {
        if (topLevelContentEvent(event)) {
            resetForCurrentDocument();
            if (event.detail) {
                lastSafeAreaInsetUsage |= event.detail & 0x0f;
            }
            notifyViewportFit();
        }
    }, true);

    addEventListener("DOMContentLoaded", function(event) {
        if (topLevelContentEvent(event)) {
            resetForCurrentDocument();
            notifyViewportFitAfterStyle();
        }
    }, true);

    addEventListener("unload", function() {
        clearThemeColorObservers();
    }, false);

    notifyViewportFitAfterStyle();
})();
