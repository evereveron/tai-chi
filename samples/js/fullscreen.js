/*
 * Work in progress based on current fullscreen JS APIs
 * Based on work by John Dyer
 * http://johndyer.name/native-fullscreen-javascript-api-plus-jquery-plugin/
 */
(function() {
    var fullScreenApi = {
        supportsFullScreen: false,
        isFullScreen: function() { return false; },
        requestFullScreen: function() {},
        cancelFullScreen: function() {},
        fullScreenEventName: '',
        prefix: ''
    },
    browserPrefixes = 'webkit moz o ms khtml'.split(' ');
    // check for native support
    if (typeof document.cancelFullScreen != 'undefined') {
        fullScreenApi.supportsFullScreen = true;
    } else {
        // check for fullscreen support by vendor prefix
        for (var i = 0, il = browserPrefixes.length; i < il; i++ ) {
            fullScreenApi.prefix = browserPrefixes[i];
            if (typeof document[fullScreenApi.prefix + 'CancelFullScreen'] != 'undefined' 
                || typeof document[fullScreenApi.prefix + 'ExitFullscreen'] != 'undefined') {
                fullScreenApi.supportsFullScreen = true;
            break;
            }
        }
    }
// update methods to do something useful
if (fullScreenApi.supportsFullScreen) {
    fullScreenApi.fullScreenEventName =  (fullScreenApi.prefix === 'ms') ? 'MSFullscreenChange'  : fullScreenApi.prefix + 'fullscreenchange';
    fullScreenApi.isFullScreen = function() {
        switch (this.prefix) {
            case '':
                return document.fullScreen;
            case 'ms':
                return !!document.msFullscreenElement;
            case 'webkit':
                return document.webkitIsFullScreen;
            default:
                return document[this.prefix + 'FullScreen'];
        }
    }
    fullScreenApi.requestFullScreen = function(el) {
        return (this.prefix === '') ?
            el.requestFullScreen()
            : (this.prefix === 'ms') ?
                el.msRequestFullscreen()
                : el[this.prefix + 'RequestFullScreen']() ;
    }
    fullScreenApi.cancelFullScreen = function() {
        return (this.prefix === '') ?
            document.cancelFullScreen()
            : (this.prefix === 'ms') ?
                document.msExitFullscreen()
                : document[this.prefix + 'CancelFullScreen']();
    }
}
// jQuery plugin
if (typeof jQuery != 'undefined') {
    jQuery.fn.requestFullScreen = function() {
        return this.each(function() {
            var el = jQuery(this);
            if (fullScreenApi.supportsFullScreen) {
                fullScreenApi.requestFullScreen(el);
            }
        });
    };
}
// export api
window.fullScreenApi = fullScreenApi;
})();

$(document).ready(function() {
var fullscreenbutton = $('#fullscreenbtn');

    if (window.fullScreenApi.supportsFullScreen) {
        // handle button click
        var fullscreenEventNode = document.getElementById('videocontainer');
        fullscreenbutton.show();
        fullscreenbutton.click(function() {
            window.fullScreenApi.requestFullScreen($('#videocontainer')[0]);
        });

        if (window.fullScreenApi.prefix === 'ms') {
            fullscreenEventNode = document;
        }

        fullscreenEventNode.addEventListener(fullScreenApi.fullScreenEventName, function() {
            if (fullScreenApi.isFullScreen()) {
                $('#videocontainer').first().css('width','100%').css('height','100%').css('padding','0').css('border','none');
                $('#videocontainer object').css('width','100%').css('height','100%').css('padding','0').css('border','none');
            } else {
                $('#videocontainer').first().css('width','364px').css('height','273px').css('padding','').css('border','');
                // chrome does not correctly re-size children to container 100% height.  Set it to container height, then back to 100% after a brief timeout
                $('#videocontainer object').first().css('width','364px').css('height','273px').css('padding','').css('border','');
                setTimeout(function() {
                    $('#videocontainer object').first().css('width','100%').css('height','100%').css('padding','').css('border','');
                },100);
            }
        }, true);
    } else {
        fullscreenbutton.hide();
    }
});