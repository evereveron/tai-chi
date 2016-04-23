var popupwindow = null;
var pinpwin = null;
var thiswindow = window;
var globalreg = null;
var about = null;
var dockSelector = "#localPreviewDockingElement";
var externalWindowState = {};
var popupForSSO = null;
var isPlayOnAllDevices = false;
var isMultimediaStarted = false;
var signingOut = false;

function pinpLoaded(win, id) {
	thiswindow.pinpwin = win;
	if (id) {
		thiswindow.pinpVideoObject = $('#' + id, win.document)[0];
		var currentClass = $('#showpinpvideo').attr('class');
		var classId = pinpsequence.indexOf(currentClass);
		if (classId !== 0) {
			$(document).cwic('addPreviewWindow', {
				previewWindow: thiswindow.pinpVideoObject,
				"window": thiswindow.pinpwin
			});
		}
	} else {
		if (jQuery(document).cwic('about').capabilities.video && !thiswindow.pinpVideoObject) {
			win.createVideoWindow();
		}
	}
}

function pinpUnloaded(win, id) {
	thiswindow.pinpwin = null;
	$(document).cwic('removePreviewWindow', {
		previewWindow: id,
		window: win
	});
}

window.popupVideoObjectLoaded = function (win, id) {
	thiswindow.popupwindow = win;
	calls.getCallDiv().cwic('updateConversation', {
		addRemoteVideoWindow: id,
		window: win
	});
}

window.popupUnloaded = function (win, id) {
	thiswindow.popupwindow = null;
}

/**
 * These settings are passed into the 'init' method.
 */
var settings = {
	/* Callback when phone is ready for use */
	ready: jabberSDKReady,
	/* Error callback */
	error: phoneErrorCallback,
	verbose: true,
	log: function (msg, context) {
		//console.trace();
		if (typeof console !== "undefined" && console.log) {
			console.log(msg);
			if (context) {
				if (console.dir) {
					console.log(context);
				} else if (typeof JSON !== "undefined" && JSON.stringify) {
					console.log(JSON.stringify(context, null, 2));
				} else {
					console.log(context);
				}
			}
		};
	},
	serviceDiscovery: true,
	redirectUri: 'http://localhost:8000/samples/ssopopup.html',
	emailRequired: handleEmailRequired,
	credentialsRequired: handleCredentialsRequired,
	signedIn: handleSSOSignedIn
};

// Set of DTMF characters that we want to allow
var dtmfchars = {
	'0': '0',
	'1': '1',
	'2': '2',
	'3': '3',
	'4': '4',
	'5': '5',
	'6': '6',
	'7': '7',
	'8': '8',
	'9': '9',
	'#': '#',
	'*': '*'
};

/*
 * Multiple-call settings
 */
var calls = multiCallContainer('call', 'calllist');

var videoObject = null;
var previewVideoObject = null;
var pinpVideoObject = null;

var showLocalVideo = false;
// Used to track a conversation id that does not yet have a video window to associate to
var delayedVideoConversation = null;


function popoutVideo() {
	var height = 520;
	var width = 700;
	if (popupwindow === null || popupwindow.closed) {
		var l = (screen.width - width) - 16; // offset by 16 pixels for IE borders
		var t = 0;
		var windowsettings = 'height=' + height + ',width=' + width + ',top=' + t + ',left=' + l + ',location=no,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no';
		var popupUrl = "popout.html";
		popupwindow = window.open(popupUrl, "_cwicvideo", windowsettings);
		if (popupwindow !== null) {
			popupwindow.focus();
		}
	} else {
		popupwindow.focus();
	}
}

function showVersions(about) {
	$('#jsversion').text(about.javascript.version);
	$('#jssystem_release').text(about.javascript.system_release);
	$('#jqueryversion').text(about.jquery.version);
	if (about.plugin) {
		$('#pluginversion').text(about.plugin.version.plugin);
		$('#pluginsystem_release').text(about.plugin.version.system_release);
	}
	if (about.channel) {
		$('#channelversion').text(about.channel.version);
		$('#channelsystem_release').text(about.channel.system_release);
	}
	if (about.upgrade) {
		var msg = '';
		if (about.upgrade.plugin) {
			msg += 'plugin upgrade <b>' + about.upgrade.plugin + '</b><br>';
		}
		if (about.upgrade.javascript) {
			msg += 'cwic javascript upgrade <b>' + about.upgrade.javascript + '</b><br>';
		}
		$('#msgcontainer').append(msg);
	}
}
/**
 * This callback is invoked when the phone plugin is available for use.
 */
function jabberSDKReady(defaults, phoneRegistered, phoneMode) {
	$('#remotevideocontainer').cwic('createVideoWindow', {
		id: 'videocallobject',
		success: function (id) {
			videoObject = document.getElementById(id);
			if (delayedVideoConversation) {
				// The update for the conversation that video is ready can occur before the createVideoWindow() call
				// returns asynchronously on some browsers, especially on Safari and background tabs.  Add the video
				// window to the call now.
				calls.getCallDiv(delayedVideoConversation.callId).cwic('updateConversation', {
					'addRemoteVideoWindow': videoObject
				});
				delayedVideoConversation = null;
			}

		}
	});

	// get the state of the external window renderer
	jQuery(document).cwic('getExternalWindowState');

	$('#localvidcontainer').cwic('createVideoWindow', {
		id: 'localPreviewVideo',
		success: function (id) {
			previewVideoObject = $('#' + id)[0];
		}
	});

	if (pinpwin && pinpwin.createVideoWindow) {
		pinpwin.createVideoWindow();
	}
	about = $('#phonecontainer').cwic('about');
	showVersions(about);

	if (!about.capabilities.videoPluginObject) {
		// disable the in-browser video windows if the plug-in does not have the capability.
		$('#fullscreenbtn, #popoutbtn, #showpinpvideo').attr('disabled', true);
	}
	if (about.capabilities.externalWindowDocking) {
		$('#localvidcontainer').append('<div id="localPreviewDockingElement"></div>')
		$(dockSelector).cwic('dock');
	}
	setupUIHandlers();
	refreshMMDevices();
	eventHandlerSetup();

	if (phoneRegistered) {
		setUILoggedIn();
	}
};

function phoneErrorCallback(error, exception) {
	if (error) {
		var EXT_MISSING_CODE = 'ExtensionNotAvailable';
		settings.log('phone error: ', error);

		var msg = 'ERROR: cannot initialize phone: ' + error.message + ' (code ' + error.code + ')<br>' + 'Details: ' + error.details + '<br>';

		if (error.code == EXT_MISSING_CODE) {
			msg += '\nChrome extension available at <a href="https://chrome.google.com/webstore/detail/cisco-web-communicator/ppbllmlcmhfnfflbkbinnhacecaankdh/" target="_blank" style="color:blue">chrome web store</a>.';
		}

		$('#msgcontainer').empty().html('<b style="color:red">' + msg + '</b>');

		about = $().cwic('about');
		showVersions(about);
	}

	if (exception) {
		settings.log('exception: ', exception);
	}
};

function eventHandlerSetup() {
	addCwicEventHandlers();
	addUIClickHandlers();
}

function addCwicEventHandlers() {
	/**
	 * Add handlers for conversationStart and conversationIncoming events
	 */
	$('#phonecontainer')
		.bind('conversationStart.cwic', handleConversationStart)
		.bind('conversationIncoming.cwic', handleConversationIncoming)
	/**
	 * Handle system events - these are issued when the webphone plugin is handling things like
	 * IP address changes.
	 */
		.bind('system.cwic', handleSystemEvent)
		.bind('mmDeviceChange.cwic', handleMMDeviceChange)
		.bind('ringtonesListAvailable.cwic', handleAvailableRingtones)
		.bind('ringtoneChange.cwic', handleRingtoneChange)
		.bind('externalWindowEvent.cwic', handleExternalWindowEvent)
		.bind('callTransferInProgress.cwic', handleCallTransfer)
		.bind('ssoNavigateTo.cwic', handleNavigateTo)
		.bind('invalidCertificate.cwic', handleInvalidCert)
		.bind('multimediaCapabilities.cwic', handleMultimediaCapabilities)

	$(document).bind('error.cwic', handleError);
}

function addUIClickHandlers() {
	$('#switchmodebtn').click(switchModeClick);

	$('#showpinpvideo').click(switchPinPVideo);
	$('input:radio[name=showlocalvideo]').click(switchPreviewVideo);
	$('#togglepreview').click(switchPreviewVideo1);

	/**
	 * Conference Feature
	 */
	$('#conferencebtn').click(conferenceButtonClick);
	$('#transferbtn').click(transferButtonClick);

	$('#speakervolumebtn').click(speakerVolumeClick);
	$('#ringervolumebtn').click(ringerVolumeClick);
	$('#micvolumebtn').click(microphoneVolumeClick);
	$('.manualsignin').click(showManualSignInView);
	$('.showinitialiew').click(showInitialSignInView);
	$('.cancelsso').click(handleSSOCancel);
	$('.reset').click(handleResetData);

	// Handle the sign in button's behavior
	$('#signinbtn').click(function (event) {
		event.preventDefault();
		signIn($('#username').val(), $('#password').val(), $('#cucm').val(), $('#mode').val());
	});

	// Handle the externalpreview button's behavior
	$('#externalpreview').click(function () {
		jQuery(document).cwic('showPreviewInExternalWindow');
		jQuery(document).cwic('setExternalWindowTitle', "Cisco Web Communicator");
		if (about.capabilities.externalWindowDocking && dockSelector === "#localPreviewDockingElement") {
			$('input:radio[name=showlocalvideo]:eq(0)').attr("checked", "checked");
			showLocalVideo = "On";
		}
	});

	// Handle the closeexternalwindow button's behavior
	$('#closeexternalwindow').click(function () {
		jQuery(document).cwic('hideExternalWindow');
		if (about.capabilities.externalWindowDocking && dockSelector === "#localPreviewDockingElement") {
			$('input:radio[name=showlocalvideo]:eq(1)').attr("checked", "checked");
			showLocalVideo = "Off";
		}
	});

	$('.dockbtn').click(function dockButtonClick() {
		if (about.capabilities.externalWindowDocking && dockSelector === "#localPreviewDockingElement") {
			$('#localPreviewContainer').show();
		}
		$(dockSelector).cwic('dock');
	});
	$('.undockbtn').click(function undockButtonClick() {
		if (about.capabilities.externalWindowDocking && dockSelector === "#localPreviewDockingElement") {
			$('#localPreviewContainer').hide();
		}
		$().cwic('undock');
	});

	$("#alwaysOnTop").change(function () {
		if ($(this).is(':checked')) {
			jQuery(document).cwic('setExternalWindowAlwaysOnTop', true);
		} else {
			jQuery(document).cwic('setExternalWindowAlwaysOnTop', false);
		}
	});

	$("#showSelfViewPip").change(function () {
		if ($(this).is(':checked')) {
			jQuery(document).cwic('setExternalWindowShowSelfViewPip', true);
		} else {
			jQuery(document).cwic('setExternalWindowShowSelfViewPip', false);
		}
	});

	var showControls = false;
	$("#togglecontrols").click(function () {
		showControls = !showControls;
		jQuery(document).cwic('setExternalWindowShowControls', showControls);
	});
	
	var showBorder = false;
	$("#togglepipborder").click(function () {
		showBorder = !showBorder;
		jQuery(document).cwic('setExternalWindowShowSelfViewPipBorder', showBorder);
	});

	// Handle the signOut button's behavior
	$('#signoutbtn').click(function () {
		showInitialSignInView();
		$('#incomingcontainer, #callcontainer').hide();
		disable($('#signoutbtn'));
		$().cwic('hideExternalWindow');
		signOut();
	});


}

function handleMMDeviceChange() {
	refreshMMDevices();
};

function handleRingtoneChange(event) {
	console.log("ringtoneChange", event);
	$('#mmDevices #ringtonesSelect').val(event.currentRingtone);
};

function handleVolumeChange(deviceInfo) {
	if (deviceInfo.device == "Speaker") {
		$('#speakervolumecontrol').val(deviceInfo.volume);
	}
	else if (deviceInfo.device == "Microphone") {
		$('#microphonevolumecontrol').val(deviceInfo.volume);
	}
	else if (deviceInfo.device == "Ringer") {
		$('#ringervolumecontrol').val(deviceInfo.volume);
	}

}

function handleExternalWindowEvent(stateEvent) {
	settings.log('externalWindowEvent :', stateEvent);
	externalWindowState = stateEvent.externalWindowState;
	$("#showSelfViewPip").attr('checked', stateEvent.externalWindowState.selfViewPip);
	$("#alwaysOnTop").attr('checked', stateEvent.externalWindowState.alwaysOnTop);
}

function handleMultimediaCapabilities(event) {
	isMultimediaStarted = event.multimediaCapability;

	if (!isMultimediaStarted) {
		clearMultimediaUIFields();
	}
}

function clearMultimediaUIFields() {
	$("#recordingDevicesSelect").empty();
	$("#playoutDevicesSelect").empty();
	$("#captureDevicesSelect").empty();
	$("#ringerDevicesSelect").empty();
	$("#speakervolumecontrol").val('');
	$("#ringervolumecontrol").val('');
	$("#microphonevolumecontrol").val('');
	$("#ringtonesSelect").empty();
}

function handleAvailableRingtones(event) {
	var availableRingtones = event.ringtones;
	var ringtonesSelect = $('#mmDevices #ringtonesSelect');
	ringtonesSelect.empty();
	if (availableRingtones) {
		for (var i = 0; i < availableRingtones.length; i++) {
			ringtonesSelect.append($("<option></option>")
				.text(availableRingtones[i].name));
		}
	}
}

/*
 * When page is loaded, initialize the plugin.
 */
$(document).ready(function () {
	showInitialSignInView();

	function onCwicLoaded() {
		settings.log('onCwicLoaded');

		// set the source of the picture-in-picture iframe (requires cwic to be available)
		$('#pinpwindow').attr('src', 'pinp.html');

		$('#calllist').click(calls.callListClick);

		$('#phonecontainer').cwic('init', settings);

	}

	// use static loading for now, cwic.js is included at the top of this file
	// and call onCwicLoaded straight away
	onCwicLoaded();
});

function handleLoggedOut() {
	calls.removeAll();
	enable($('#username'));
	enable($('#cucm'));
	enable($('#mode'));
	disable($('#dntodial'));
	disable($('#callbtn'));
	enable($('#signinbtn'));
	disable($('#signoutbtn'));
	disable($('#switchmodebtn'));
	disable($('.externalbtns'));

	showInitialSignInView(); 
            
	$('#devices').empty();
	$('#currentmode').empty();
	$('#currentline').empty();
	$('#lines').empty();
	
	signingOut = false;

}

/**
 * Helper function to signOut
 */
function signOut() {
	signingOut = true;
	
	// unregisterPhone also exists
	$('#phonecontainer').cwic('signOut', {
		// the complete callback is always called after unregistering
		complete: function () {
			handleLoggedOut();
		}
	});
};

function getMultimediaDeviceVolume(device) {
	$().cwic('getMultimediaDeviceVolume', device, handleVolumeChange);
}

function refreshMMDevices() {

	var recordingDevicesSelect = $('#mmDevices #recordingDevicesSelect');
	recordingDevicesSelect.empty();

	var captureDevicesSelect = $('#mmDevices #captureDevicesSelect');
	captureDevicesSelect.empty();

	var playoutDevicesSelect = $('#mmDevices #playoutDevicesSelect');
	playoutDevicesSelect.empty();

	var ringerDevicesSelect = $('#mmDevices #ringerDevicesSelect');
	ringerDevicesSelect.empty();

	var devices = $().cwic('getMultimediaDevices');

	if (devices) {
		if (devices.multimediadevices) {
			// setting the All available devices for ringer
			if (about.capabilities.ringtoneSelection && devices.multimediadevices.length > 0) {
				ringerDevicesSelect.append($("<option></option>").val("alldevices").text("All available devices"))
			}
			for (var i = 0; i < devices.multimediadevices.length; i++) {
				if (devices.multimediadevices[i].canRecord) {
					// In order to set a device as a recording device, send in the clientRecordingID to setRecordingDevice().
					// Depending on the platform, it may match other fields, but it will always be the value that works for
					// setRecordingDevice.  We save it here as clientID, so we can send it when the Set Recording Device button
					// is pushed.
					recordingDevicesSelect.append($("<option></option>")
						.attr("value", devices.multimediadevices[i].clientRecordingID)
						.text(devices.multimediadevices[i].deviceName + ((devices.multimediadevices[i].isDefault) ? " *" : "")));
				}

				if (devices.multimediadevices[i].canPlayout) {
					playoutDevicesSelect.append($("<option></option>")
						.attr("value", devices.multimediadevices[i].clientPlayoutID)
						.text(devices.multimediadevices[i].deviceName + ((devices.multimediadevices[i].isDefault) ? " *" : "")));
				}

				if (devices.multimediadevices[i].canCapture) {
					captureDevicesSelect.append($("<option></option>")
						.attr("value", devices.multimediadevices[i].clientCaptureID)
						.text(devices.multimediadevices[i].deviceName + ((devices.multimediadevices[i].isDefault) ? " *" : "")));
				}

				if (devices.multimediadevices[i].canRing) {
					ringerDevicesSelect.append($("<option></option>")
						.attr("value", devices.multimediadevices[i].clientRingerID)
						.text(devices.multimediadevices[i].deviceName + ((devices.multimediadevices[i].isDefault) ? " *" : "")));
				}

				if (devices.multimediadevices[i].isSelectedRecordingDevice) {
					recordingDevicesSelect.val(devices.multimediadevices[i].clientRecordingID);
				}

				if (devices.multimediadevices[i].isSelectedPlayoutDevice) {
					playoutDevicesSelect.val(devices.multimediadevices[i].clientPlayoutID);
				}

				if (devices.multimediadevices[i].isSelectedCaptureDevice) {
					captureDevicesSelect.val(devices.multimediadevices[i].clientCaptureID);
				}
				if (isPlayOnAllDevices) {
					ringerDevicesSelect.val("alldevices");
				}
				else if (devices.multimediadevices[i].isSelectedRingerDevice) {
					ringerDevicesSelect.val(devices.multimediadevices[i].clientRingerID);
				}
			}
			getMultimediaDeviceVolume("Speaker");
			getMultimediaDeviceVolume("Ringer");
			getMultimediaDeviceVolume("Microphone");
		}
	}
};

function setCaptureDevice() {
	var capSelect = $('#captureDevicesSelect');
	var optSel = $('#captureDevicesSelect option:selected');

	if (optSel && optSel.val()) {
		$().cwic('setCaptureDevice', optSel.val());
		refreshMMDevices();
	}
}

function setRecordingDevice() {
	var capSelect = $('#recordingDevicesSelect');
	var optSel = $('#recordingDevicesSelect option:selected');

	if (optSel && optSel.val()) {
		$().cwic('setRecordingDevice', optSel.val());
		refreshMMDevices();
	}
}

function setPlayoutDevice() {
	var capSelect = $('#playoutDevicesSelect');
	var optSel = $('#playoutDevicesSelect option:selected');

	if (optSel && optSel.val()) {
		$().cwic('setPlayoutDevice', optSel.val());
		refreshMMDevices();
	}
}

function setRingerDevice() {
	var capSelect = $('#ringerDevicesSelect');
	var optSel = $('#ringerDevicesSelect option:selected');

	if (optSel && optSel.val()) {

		if (optSel.val() == "alldevices") {
			if (about.capabilities.ringOnAllDevices) {
				$().cwic('setPlayRingerOnAllDevices');
				isPlayOnAllDevices = true;
			}
		}
		else {
			$().cwic('setRingerDevice', optSel.val());
			isPlayOnAllDevices = false;
		}
		refreshMMDevices();
	}
}

function setRingtone() {
	var capSelect = $('#ringtonesSelect');
	var optSel = $('#ringtonesSelect option:selected');

	if (optSel && optSel.val()) {
		$().cwic('setRingtone', optSel.val());
	}
}

/**
 * Set up the UI's handlers for clicks and cwic events. Doing this once prevents bugs from multiple
 * events being fired
 */
function setupUIHandlers() {
	$('#popoutbtn').click(popoutVideo);
	$('#callbtn').click(callButtonClick);
	$('#callcontainer .holdresumebtn').click(holdResumeButtonClick);
	$('#callcontainer .muteaudiobtn').click(muteButtonClick);
	$('#callcontainer .mutevideobtn').click(muteButtonClick);
	$('#callcontainer .escalatebtn').click(escalateButtonClick);

	$('#dntodial').keypress(function (event) {
		var conversation = calls.getSelectedCall();
		if (conversation && conversation.capabilities.canSendDigit) {
			var char = String.fromCharCode(event.charCode || event.keyCode);
			if (dtmfchars[char]) {
				calls.getCallDiv().cwic('sendDTMF', char);
			}
		}
	});

	$('#callcontainer .endbtn').click(endButtonClick);

	$('#mmDevices .refreshMMDevices').click(function () {
		refreshMMDevices();
	});

	$('#mmDevices #captureDevicesSelect').change(function () {
		setCaptureDevice();
		refreshMMDevices();
	});

	$('#mmDevices #recordingDevicesSelect').change(function () {
		setRecordingDevice();
		refreshMMDevices();
	});

	$('#mmDevices #playoutDevicesSelect').change(function () {
		setPlayoutDevice();
		refreshMMDevices();
	});

	$('#mmDevices #ringerDevicesSelect').change(function () {
		setRingerDevice();
		refreshMMDevices();
	});

	$('#mmDevices #ringtonesSelect').change(function () {
		if (about.capabilities.ringtoneSelection) {
			setRingtone();
		}
		refreshMMDevices();
	});

	$('#selfview-position-btn').click(function () {
		var tlx = $('#top-left-x').val(),
			tly = $('#top-left-y').val(),
			brx = $('#bottom-right-x').val(),
			bry = $('#bottom-right-y').val();

		$().cwic('setExternalWindowSelfViewPipPosition', {
			topLeftX: tlx,
			topLeftY: tly,
			bottomRightX: brx,
			bottomRightY: bry
		});
	});

}

/**
 * preview video radio toggle handler
 */
function switchPreviewVideo(evt) {
	if (showLocalVideo !== evt.target.value) {
		showLocalVideo = evt.target.value;
		if (showLocalVideo === "On") {
			if (about.capabilities.externalWindowDocking && externalWindowState.docking && dockSelector === "#localPreviewDockingElement") {
				jQuery(document).cwic('showPreviewInExternalWindow');
			} else {
				$('#localPreviewVideo').css('width', '');
				$('#localPreviewVideo').css('height', '');
				$(document).cwic('addPreviewWindow', {
					previewWindow: 'localPreviewVideo' /*previewVideoObject*/
				});
			}
		} else {
			if (about.capabilities.externalWindowDocking && externalWindowState.docking && dockSelector === "#localPreviewDockingElement") {
				jQuery(document).cwic('hideExternalWindow');
			} else {
				$(document).cwic('removePreviewWindow', {
					previewWindow: 'localPreviewVideo' /*previewVideoObject*/
				});
				$('#localPreviewVideo').css('height', '0px');
				$('#localPreviewVideo').css('width', '0px');
			}
		}
	}
}

function switchPreviewVideo1() {
	if (showLocalVideo === "Off") {
		$('#localPreviewVideo').css('display', '');
		$(document).cwic('addPreviewWindow', {
			previewWindow: previewVideoObject
		});
		showLocalVideo = "On";
	} else {
		$(document).cwic('removePreviewWindow', {
			previewWindow: previewVideoObject
		});
		$('#localPreviewVideo').css('display', 'none');
		showLocalVideo = "Off";
	}
}

/**
 * switch position/visibility of picture-in-picture
 */
var pinpsequence = ['off', 'bottomright', 'bottomleft', 'topleft', 'topright'];

function switchPinPVideo(evt) {
	var currentClass = $('#showpinpvideo').attr('class');
	var classId = pinpsequence.indexOf(currentClass) + 1;
	if (classId >= pinpsequence.length) {
		classId = 0;
	}
	$('#showpinpvideo').attr('class', pinpsequence[classId]);
	$('#pinpwindow').attr('class', pinpsequence[classId]);
	if (classId === 0) {
		$(document).cwic('removePreviewWindow', {
			previewWindow: pinpVideoObject,
			"window": pinpwin
		});
	} else {
		$(document).cwic('addPreviewWindow', {
			previewWindow: pinpVideoObject,
			"window": pinpwin
		});
	}
}
/**
 * Set the UI state to logged in
 */
function setUILoggedIn() {
	$('#msgcontainer').empty();
	disable($('#username'));
	enable($('#dntodial'));
	disable($('#cucm'));
	disable($('#mode'));
	disable($('#signinbtn'));
	enable($('#signoutbtn'));
	$('#switchmodebtn').removeAttr('disabled');
	$('#callbtn').removeAttr('disabled');
};
/**
 * 
 * Sign in the webphone.
 */
function signIn(user, password, cucm, phoneMode) {
	var forcereg = $('#forcereg').attr('checked');
	disable($('#signinbtn'));
	$('#msgcontainer').empty();
	$('#phonecontainer').cwic('registerPhone', {
		user: user,
		password: password,
		cucm: (cucm || '').split(','), // array of string
		mode: phoneMode,
		forceRegistration: forcereg,

		devicesAvailable: handleDevicesAvailable,
		/**
		 * Callback that's invoked when phone is successfully registered.
		 * Use this callback to enable UI controls etc to enable calls to be made.
		 */
		success: handleSignInSuccess,
		/**
		 * Callback that's invoked if registration fails for some reason.
		 */
		error: handleSignInFailure
	}); // End of registerPhone

	// disable fullscreen, popout and PIP buttons on call container if phone mode is not 'SoftPhone'. Enable if phone mode is 'SoftPhone'.
	if (phoneMode != 'SoftPhone') {
		disable($('#fullscreenbtn, #popoutbtn, #showpinpvideo'));
	} else {
		if (about.capabilities.videoPluginObject) {
			enable($('#popoutbtn'));
			enable($('#fullscreenbtn'));
		}
		enable($('#showpinpvideo'));
	}
}

// used both for manual sign in and service discovey based sign in
function handleDevicesAvailable(devices, phoneMode, callback) {
	var deviceSelected = false;
	$('#devices').children().remove();

	for (var i = 0; i < devices.length; i++) {
		if ((phoneMode === "SoftPhone" && devices[i].isSoftPhone) || (phoneMode === "DeskPhone" && devices[i].isDeskPhone)) {
			$('#devices').append($('<option>', {
				value: devices[i].name + ":"
			}).text(devices[i].name).attr('title', devices[i].modelDescription));
		}
	}
            
	// unbind first, because devicesAvailable callback can be called multiple times during the same sign in session.
	$('#connectbtn').unbind().bind('click', function () {
		var device = $('#devices').val().split(':');
		if (device) {
			callback(phoneMode, device[0], device[1]);
		}
	});
	enable($('#connectbtn'));
	enable($('#devices'));
}

function handleSignInFailure(error) {
	var msg = 'Unable to sign in or connect: ' + error.message + ' ';
	msg += error.details.join(', ');
	$('#msgcontainer').html(msg);
	enable($('#username'));
	enable($('#cucm'));
	enable($('#mode'));
	enable($('#signinbtn'));
	disable($('#signoutbtn'));
	disable($('#callbtn'));
	disable($('#switchmodebtn'));
	disable($('#callbtn'));
	showInitialSignInView();
}

function handleSignInSuccess(registration) {
	settings.log('Registration succeeded. Registration: ', registration);
	globalreg = registration;
	// multiline - set lines container after registering
	setLineDNs();
	setCurrentMode();
	// multiline
            
	disable($('#connectbtn'));
	disable($('#devices'));
	$('#msgcontainer').empty();
	settings.log('phone is ready, enable make call');
	setUILoggedIn();
	$('.signinview').hide();

}


function updateConversationInfo(conversation, callcontainer) {
	if (signingOut) {
		return;
	}
	
	if (!calls.getSelectedCall() || calls.getSelectedCall().callId !== conversation.callId) {
		// special case where hold shows up for previous call after the current call is answered if the
		// previous call was in process when the user clicked answer to a new incoming call.
		// Remove the video window so it blanks out correctly
		if (conversation && conversation.callState && (conversation.callState === 'Hold' || conversation.callState === 'RemHold')) {
			settings.log("Hold received for non-current call, checking for video");
			if (videoObject) {
				settings.log("Hold received for non-current call, removing video conversation.callId: " + conversation.callId);
				calls.getCallDiv(conversation.callId).cwic('updateConversation', {
					'removeRemoteVideoWindow': videoObject
				});
			}
		} else {
			settings.log("updateConversationInfo() event not for current call, ignoring");
		}

		return;
	}

	var $callcontainer = $(callcontainer);

	updateTransferConferenceLists(conversation);

	$callcontainer.css('display', 'inline-block');

	if (conversation.isConference) {
		$callcontainer.find('.remotename').text("Conference");
	} else {
		$callcontainer.find('.remotename').text(conversation.participant.number + ((conversation.participant.name === "") ? "" : " - " + conversation.participant.name));
	}

	$callcontainer.find('.callinfo').text(conversation.callState);

	if (conversation.callState === 'Hold' || conversation.callState === 'RemHold') {
		// In some cases, if the video window is not removed on hold, it cannot be re-added
		// on resume.
		// remove the video window from a call on hold to blank out the video window
		// and to allow the video to be re-added properly when the call is resumed later

		settings.log("Hold received, removing video");
		$callcontainer.find('.holdresumebtn').attr('disabled', !conversation.capabilities.canResume).text('Resume').addClass('held');
		if (videoObject) {
			calls.getCallDiv().cwic('updateConversation', {
				'removeRemoteVideoWindow': videoObject
			});
		}
	} else {
		$callcontainer.find('.holdresumebtn').attr('disabled', !conversation.capabilities.canHold).text('Hold').removeClass('held');
	}
	$callcontainer.find('.endbtn').attr('disabled', !conversation.capabilities.canEndCall);

	if (conversation.callState === 'Reorder') {
		$callcontainer.find('.callinfo').text('Call failed');
	}

	if (!(conversation.videoDirection === 'RecvOnly' || conversation.videoDirection === 'SendRecv')) {
		$('#videocontainer').hide();
	} else {
		$('#videocontainer').show();
	}

	if (conversation && conversation.callState === 'Connected' && (conversation.videoDirection === 'RecvOnly' || conversation.videoDirection === 'SendRecv')) {
		if ($('#mode').val() == 'SoftPhone') {
			dockSelector = '#remotevideocontainer';
			if (about.capabilities.externalWindowDocking && externalWindowState.docking) {
				$(dockSelector).cwic('dock');
				$('#localPreviewContainer').hide();
			}
			calls.getCallDiv().cwic('showCallInExternalWindow');
			calls.setExternalVideoTitle();
		}

		if (videoObject) {
			calls.getCallDiv().cwic('updateConversation', {
				'addRemoteVideoWindow': videoObject
			});
		} else {
			// The update for the conversation that video is ready can occur before the createVideoWindow() call
			// returns asynchronously on some browsers, especially on Safari and background tabs.  Save off the
			// conversation so that we can add the window to it when it is ready.
			delayedVideoConversation = conversation;
		}
		if (popupwindow && !popupwindow.closed && popupwindow.videoObject) {
			calls.getCallDiv().cwic('updateConversation', {
				'addRemoteVideoWindow': popupwindow.videoObject,
				window: popupwindow
			});
		}
	}
	
	if (conversation.audioMuted) {
		$callcontainer.find('.muteaudiobtn').attr('disabled', !conversation.capabilities.canUnmuteAudio);
		$callcontainer.find('.muteaudiobtn').text('Unmute Audio').addClass('muted');
	} else {
		$callcontainer.find('.muteaudiobtn').attr('disabled', !conversation.capabilities.canMuteAudio);
		$callcontainer.find('.muteaudiobtn').text('Mute Audio').removeClass('muted');
	}

	if (conversation.videoMuted) {
		$callcontainer.find('.mutevideobtn').attr('disabled', !conversation.capabilities.canUnmuteVideo);
		$callcontainer.find('.mutevideobtn').text('Unmute Video').addClass('muted');
	} else {
		$callcontainer.find('.mutevideobtn').attr('disabled', !conversation.capabilities.canMuteVideo);
		$callcontainer.find('.mutevideobtn').text('Mute Video').removeClass('muted');
		calls.setExternalVideoTitle();
	}

	if (conversation.videoDirection === "Inactive" || conversation.videoDirection === "RecvOnly") {
		$callcontainer.find('.escalatebtn').text('Escalate').attr('disabled', !conversation.capabilities.canUpdateVideoCapability);
	} else {
		$callcontainer.find('.escalatebtn').text('De-escalate').attr('disabled', !conversation.capabilities.canUpdateVideoCapability);
	}


}


function getCwicClasses(el) {
	var classes = jQuery(el).attr('class');
	var classestoadd = [];
	if (classes) {
		classes = classes.split(' ');
		for (var i = 0; i < classes.length; i++) {
			if (classes[i].substring(4, 0) === 'cwic') {
				classestoadd.push(classes[i]);
			}
		}
	}
	return classestoadd.join(' ');
}

function handleConversationStart(event, conversation, containerdiv) {
	calls.addCall(conversation, containerdiv);
	disable($('#closeexternalwindow'));
	disable($('#externalpreview'));
	updateConversationInfo(conversation, '#callcontainer');
};

function handleConversationIncoming(event, conversation, containerdiv) {
	calls.addCall(conversation, containerdiv);
};

function handleSystemEvent(event) {
	var reason = event.phone.status || null;
	settings.log('system event with reason=' + reason);
	settings.log('system event phone.ready=' + event.phone.ready);

	if (event.phone.ready) {
		setUILoggedIn();
		$('.signinview').hide();
	}
	else if (reason == 'eConnectionTerminated') {
		$('#msgcontainer').empty().text("Logged in elsewhere - disconnecting....");
		signOut();
	}
};

function handleError(error) {
	var msg = (error.message || '') + '<br>';
	msg += error.details.join('<br>');

	try {
		if (error.nativeError) {
			msg += '<br> native error: ' + (typeof JSON !== 'undefined' && JSON.stringify) ? JSON.stringify(error.nativeError) : error.nativeError;
		}
	} catch (e) {
		if (typeof console !== "undefined" && console.trace) {
			console.trace();
		}
	}

	$('#msgcontainer').empty().html(msg);
};


/**
 * Handler for callTransferInProgress.cwic event.
 * This event is emitted only if callTransfer API is called without valid "complete" button.
 * If higher level API with "complete" button does not fit your needs, implement this handler to customize call transfer completion.
 * @param   {Object} event Event object for "callTransferInProgress.cwic" event
 * @param {function} event.completeTransfer call this function to complete call transfer
 */
function handleCallTransfer(event) {
	var $completeBtn = $('#completebtn');

	enable($completeBtn).unbind().one('click', finishCallTransfer(event.completeTransfer));

	function finishCallTransfer(fn) {
		return function (ev) {
			fn();
			disable($completeBtn).unbind();
		};
	}
}

function incomingAnswerClick(event) {
	// when answer button is clicked, click event is propagated further to the multicall container. In that case 'callListClick' is called unintentionally.
	event.stopPropagation();
	var videodirection = $('#videocall').is(':checked');
	var $call = $(this).parent().parent();
	var answerObject = $call.data('cwic');
	if (videodirection) {
		answerObject.videoDirection = 'SendRecv';
	} else {
		answerObject.videoDirection = (jQuery(document).cwic('about').capabilities.video ? 'RecvOnly' : 'Inactive');
	}
	answerObject.remoteVideoWindow = 'videocallobject';
	$call.cwic('startConversation', answerObject);
};

function incomingDivertClick(event) {
	event.stopPropagation();
	var $call = $(this).parent().parent();
	$call.cwic('endConversation', true);
};

function switchModeClick() {
	var modechange;
	if ($('#currentmode').text() == 'SoftPhone') {
		modechange = "DeskPhone";
	} else {
		modechange = 'SoftPhone';
	}

	disable($('#callbtn'));
	disable($('#switchmodebtn'));
	var forcereg = $('#forcereg').attr('checked');
	$('#phonecontainer').cwic('switchPhoneMode', {
		mode: modechange,
		success: successCb,
		error: handleSignInFailure,
		forceRegistration: forcereg
	});
	calls.removeAll();

	// switch mode success callback
	function successCb(registration) {
		setUILoggedIn();
		//clear 'Device' drop-down
		$('#devices').children().remove();
		// multiline
		globalreg = registration;
		// multiline
		setCurrentMode();
		var phoneMode = registration.mode;
		var selectedDevice = registration.device.name;

		// iterate over registration.devices object and populate 'Device' drop-down with selected device (and other devices in the same phone mode).
		for (key in registration.devices) {
			var currentDevice = registration.devices[key];
			if ((phoneMode === "SoftPhone" && currentDevice.isSoftPhone) || (phoneMode === "DeskPhone" && currentDevice.isDeskPhone)) {
				var option = $('<option>', {
					value: currentDevice.name + ":"
				}).text(currentDevice.name).attr('title', currentDevice.modelDescription);

				if (currentDevice.name == selectedDevice)
					option.attr('selected', true);

				$('#devices').append(option);
			}
		}

		// enable fullscreen, popout and PIP buttons on call container if phone mode is switched to 'SoftPhone'. Disable if user switched to 'DeskPhone'.
		if (phoneMode != 'SoftPhone') {
			disable($('#fullscreenbtn, #popoutbtn, #showpinpvideo'));
		} else {
			if (about.capabilities.videoPluginObject) {
				enable($('#popoutbtn'));
				enable($('#fullscreenbtn'));
			}
			enable($('#showpinpvideo'));
		}

		//multiline
		// show available lines if device has associated more then 1 line. Also show currently active line.
		setLineDNs();
		//multiline

	}

};

function callButtonClick() {
	var dn = $('#dntodial').val();
	var videodirection = $('#videocall').is(':checked');
	var originateObject = {
		participant: {
			recipient: dn
		},
		videoDirection: (videodirection ? 'SendRecv' : (jQuery(document).cwic('about').capabilities.video ? 'RecvOnly' : 'Inactive')),
		remoteVideoWindow: 'videocallobject'
	};
	if (dn != "") {
		$('#phonecontainer').cwic('startConversation', originateObject);
		disable($('#switchmodebtn'));
	}
};

function holdResumeButtonClick() {
	if ($(this).hasClass('held')) {
		if ($('#mode').val() == 'SoftPhone') {
			if (about.capabilities.externalWindowDocking && externalWindowState.docking) {
				$(dockSelector).cwic('dock');
			}
			calls.getCallDiv().cwic('showCallInExternalWindow');
			calls.setExternalVideoTitle();
		}

		$('#remotevideocontainer').show();
		calls.getCallDiv().cwic('updateConversation', 'resume');
	} else {
		calls.getCallDiv().cwic('updateConversation', 'hold');
	}
};

function muteButtonClick() {
	var muteIsAudio = true;
	if ($(this).hasClass('mutevideobtn')) {
		muteIsAudio = false;
	}

	if ($(this).hasClass('muted')) {
		calls.getCallDiv().cwic('updateConversation', muteIsAudio ? 'unmuteAudio' : 'unmuteVideo');
	} else {
		calls.getCallDiv().cwic('updateConversation', muteIsAudio ? 'muteAudio' : 'muteVideo');
	}
};

function endButtonClick() {
	dockSelector = "#localPreviewDockingElement";
	if (externalWindowState.docking) {
		$(dockSelector).cwic('dock');
	}

	calls.getCallDiv().cwic('endConversation');
}

function handleConversationUpdate(event, conversation, container) {
	settings.log('conversationUpdate Event for conversation:' + conversation.callId + ' on Dom node: ' + event.target.id, conversation);
	calls.addCall(conversation, container);
	updateConversationInfo(conversation, $('#callcontainer'));
}

function handleConversationEnd(event, conversation) {
	$('#callcontainer').hide();
	calls.removeCall(conversation.callId);

	settings.log('conversationEnd Event for conversation:' + conversation.callId);
	delayedVideoConversation = null;
	if (calls.isCallListEmpty()) {
		calls.removeExternalVideoTitle();
		jQuery(document).cwic('hideExternalWindow');

		enable($('#closeexternalwindow').attr('disabled', false));
		enable($('#externalpreview').attr('disabled', false));
	} else {
		calls.setExternalVideoTitle();
	}
}

function transferButtonClick() {
	var transferToNumber = $('#transferNum').val();
	var currentCall = calls.getSelectedCall();
	if (transferToNumber && currentCall.localParticipant.directoryNumber !== transferToNumber) {
		calls.getCallDiv().cwic('updateConversation', {
			transferCall: transferToNumber,
			completeButton: 'completebtn', // id or jQuery object
		});
	}
}

function speakerVolumeClick() {
	var volume = $('#speakervolumecontrol').val();
	$().cwic('setSpeakerVolume', {
		speakerVolume: volume,
		error: function (error) {
			$('#msgcontainer').empty().html('setSpeakerVolume: ' + error);
		}
	});
}

function ringerVolumeClick() {
	var volume = $('#ringervolumecontrol').val();
	$().cwic('setRingerVolume', {
		ringerVolume: volume,
		error: function (error) {
			$('#msgcontainer').empty().html('setRingerVolume: ' + error);
		}
	});
}

function microphoneVolumeClick() {
	var volume = $('#microphonevolumecontrol').val();
	$().cwic('setMicrophoneVolume', {
		microphoneVolume: volume,
		error: function (error) {
			$('#msgcontainer').empty().html('setMicrophoneVolume: ' + error);
		}
	});
}

function conferenceButtonClick() {
	var joinCallId = $("#conferencelist option:selected").val();
	var joinCall = calls.getCall(joinCallId);
	var currentCall = calls.getSelectedCall();

	if (!joinCall || !currentCall) {
		settings.log("Call does not exist");
		return;
	}
	var currentParticipants = (currentCall.isConference ? currentCall.participants.length : 1);
	var joinParticipants = (joinCall.isConference ? joinCall.participants.length : 1);
	// if 2 conference calls are joined, we get a conference with n+1 participants one of whom is a conference, not n+m participants
	if (currentCall.isConference && joinCall.isconference) {
		joinParticipants = 1;
	}

	// maxParticipants is either 0 (if not a conference), a positive number if the call is a conference, or -1 if it cannot be determined
	// if -1, we attempt to conference anyway - at worst it just won't conference and the calls are left as is
	if ((joinCall.isConference && joinCall.maxParticipants > 0 && (currentParticipants + joinParticipants > joinCall.maxParticipants)) || (currentCall.isConference && currentCall.maxParticipants > 0 && (currentParticipants + joinParticipants > currentCall.maxParticipants))) {
	    settings.log("Cannot join calls, max participants exceeded.");
	    return;
	}
	calls.getCallDiv().cwic('updateConversation', {
		'joinCall': joinCallId
	});
}

function updateTransferConferenceLists(conversation) {
	"use strict";
	var existingCalls = calls.getCalls();
	var text = '';
	$('#conferencelist').empty();
	var conferenceAvailable = false;
	var transferAvailable = false;
	if (conversation && conversation.callState === "Connected") {
		for (var call in existingCalls) {
			if (existingCalls.hasOwnProperty(call)) {
				if (conversation.capabilities.canJoinAcrossLine && existingCalls[call].callId !== conversation.callId && existingCalls[call].capabilities.canJoinAcrossLine) {
					if (existingCalls[call].isConference) {
						text = "Conference";
					} else {
						text = existingCalls[call].participant.number;
					}

					$('#conferencelist').append("<option value='" + existingCalls[call].callId + "'>" + text + "</option>");
					conferenceAvailable = true;
				}
				if (conversation.capabilities.canDirectTransfer) {
					transferAvailable = true;
				}
			}
		}
	}

	(!conferenceAvailable) ? disable($('#conferencebtn')) : enable($('#conferencebtn'));
	(!transferAvailable) ? disable($('#transferbtn')) : enable($('#transferbtn'));
};

function escalateButtonClick() {
	var currentCall = calls.getSelectedCall();
	var $callcontainer = $('#callcontainer');
	if (currentCall.videoDirection === "Inactive" || currentCall.videoDirection === "RecvOnly") {
		calls.getCallDiv().cwic('updateConversation', {
			videoDirection: 'SendRecv'
		});
		$callcontainer.find('.escalatebtn').text('De-escalate');
	} else if (currentCall.videoDirection === "SendRecv") {
		calls.getCallDiv().cwic('updateConversation', {
			videoDirection: 'RecvOnly'
		});
		$callcontainer.find('.escalatebtn').text('Escalate');
	} else if (currentCall.videoDirection === "SendOnly") {
		calls.getCallDiv().cwic('updateConversation', {
			videoDirection: 'RecvOnly'
		});
		$callcontainer.find('.escalatebtn').text('Escalate');
	} else {
		alert("invalid value for video direction!");
	}

}
// setLineDNs shows the information about available lines for currently registered phone. It also enables 'change line' feature. 'Change line' is done by using switchPhoneMode API function.
function setLineDNs() {
	"use strict";
	var $linesDropDown = $('#lines'),
		$currentline = $('#currentline'),
		$changelinebtn = $('#changelinebtn'),
		lines = globalreg.devices[globalreg.device.name].lineDNs,
		currentLine = globalreg.line.directoryNumber,
		i, numOfLines = lines.length;

	$linesDropDown.empty();
	$currentline.text(currentLine);

	if (numOfLines) {
		for (i = 0; i < numOfLines; i += 1) {
			$linesDropDown.append($("<option></option>")
				.attr("value", lines[i])
				.text(lines[i]));
		}

		$changelinebtn.unbind().bind('click', handleChangeLineClick);
	}

	if (numOfLines === 1) {
		disable($changelinebtn);
		disable($linesDropDown);
	} else {
		enable($changelinebtn);
		enable($linesDropDown);
	}

	function handleChangeLineClick() {
		var selectedLine = $('#lines').val(),
			device = $('#devices').val().split(':')[0],
			modechange = $('#mode').val(),
			forcereg = $('#forcereg').attr('checked');

		$('#switchmodebtn').cwic('switchPhoneMode', {
			mode: modechange,
			success: successCb,
			error: errorCb,
			forceRegistration: forcereg,
			device: device,
			line: selectedLine
		});

		calls.removeAll();

		function successCb(registration) {
			globalreg = registration;
			setLineDNs();

		}

		function errorCb() {
			var msg = "Error during phone line change. Please refresh the browser. ";
			$('#msgcontainer').empty().html('<b style="color:red">' + msg + '</b>');
		}


	}

}

function setCurrentMode(phoneMode) {
	phoneMode = phoneMode || globalreg.mode;
	$('#currentmode').text(phoneMode); // device selection UI
	$('#mode').val(phoneMode); // manual sign in UI
	$('#sdmode').val(phoneMode); // service discovery based sign in UI
}

function enable($el) {
	if (!($el instanceof jQuery)) {
		throw new TypeError('enable function accepts only jQuery objects')
	}
	$el.attr('disabled', false);
	return $el;
}

function disable($el) {
	if (!($el instanceof jQuery)) {
		throw new TypeError('disable function accepts only jQuery objects')
	}
	$el.attr('disabled', true);
	return $el;
}

// ******************************************************
// Service discovery based sign in BEGIN
// ******************************************************

function handleCredentialsRequired(setCredentials, cachedUser) {
	var $submitCredentialsBtn = $('#sdCredentialsSubmit'),
		$status = $('#sdCredReqStatus'),
		$username = $('#sdUsername'),
		$passphrase = $('#sdPassphrase');

	switchToView('#sdcredentialsrequired');

	$submitCredentialsBtn.click(function (event) {
		event.preventDefault();
		var user = $username.val(),
			pass = $passphrase.val();

		if (user && pass) {
			setCredentials(user, pass); // it has credentials validation mechanism built-in
		} else {
			$status.text("Cannot submit empty username or passphrase");
		}

	});

	if (cachedUser) {
		$username.val(cachedUser);
	}

}

function handleEmailRequired(setEmail, cachedEmail) {
	var $status = $('#sdEmailReqStatus'),
		$email = $('#sdEmail'),
		$setEmailBtn = $('#sdSetEmail');

	switchToView('#sdemailrequired');

	$setEmailBtn.click(function (event) {
		event.preventDefault();
		var email = $email.val();
		if (email) {
			setEmail(email);
		} else {
			$status.text("Cannot submit empty email address");
		}
	});

	if (cachedEmail) {
		$email.val(cachedEmail);
	}
}

function handleSSOSignedIn() {
	switchToView('#sdsignedin');
	enable($('.externalbtns'));
	enable($('#signoutbtn'));
}

function handleNavigateTo(event) {
	var url = event.url;

	switchToView('#sdssoinprogress');
	$('#sdssourl').text(event.url);

	//Open a child window for user interaction
	popupForSSO = window.open('', '', 'height=500,width=500,scrollbars=1');
	popupForSSO.document.write('Authorizing...');
            
	//Start the SSO sequence using the request URL
	popupForSSO.location = url;
}

function handleInvalidCert(event) {
	var certInfo = event.info,
		respond = event.respond;

	$('#certdetailstable .identifier').text(certInfo.identifierToDisplay);
	$('#certdetailstable .subjectCN').text(certInfo.certSubjectCN);
	$('#certdetailstable .reference').text(certInfo.referenceId);
	$('#certdetailstable .reason').text(certInfo.invalidReasons.join(', '));

	$('#invalidcertcontainer').show();

	if (certInfo.allowUserToAccept) {
		$('#responsebuttons .accept').unbind().one('click', function () {
			respond(certInfo.certFingerprint, true);
			$('#invalidcertcontainer').hide();
		});

		$('#responsebuttons .reject').unbind().one('click', function () {
			respond(certInfo.certFingerprint, false);
			$('#invalidcertcontainer').hide();
		});

		$('#responsebuttons').show();
                
		// or accept it without showing UI
		// respond(certInfo.certFingerpring, true);
	} else {
		$('#responsebuttons').hide();
	}
}

function showInitialSignInView() {
	var $startDiscoveryBtn = $('#startdiscovery');

	switchToView('#sdstart');

	$startDiscoveryBtn.one('click', function (event) {
		event.preventDefault();
		$('#msgcontainer').empty();
		var forceReg = $('#sdforcereg').attr('checked'),
			mode = $('#sdmode').val();

		$('#phonecontainer').cwic('startDiscovery', {
			mode: mode,
			forceRegistration: forceReg,
			devicesAvailable: handleDevicesAvailable,
			error: handleSignInFailure,
			success: handleSignInSuccess
		});
	});
}

function showManualSignInView() {
	switchToView('#mansignindetails');
}

function switchToView(viewId) {
	hideAll();
	$(viewId).show();

	function hideAll() {
		$('.signinview').hide();
	}
}

function handleSSOCancel(event) {
	try {
		popupForSSO.close();
	} catch (e) {
		// popup not found, skip closing
	}
	$('#phonecontainer').cwic('cancelSSO');
}

// only available in signed out state
function handleResetData(event) {
	$('#phonecontainer').cwic('resetData');
}

// ******************************************************
// Service discovery based sign in END
// ******************************************************