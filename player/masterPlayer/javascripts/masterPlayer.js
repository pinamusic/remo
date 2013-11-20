﻿/// <reference path="_references.js" />
"use strict";

//Player MASTER
//http://www.jplayer.org/latest/developer-guide/
////////////////////////////////////////////
var newDate = new Date();
var initialPlaylist = new Array();

//Player start config
masterPlayer.config = {
	id: parseInt(newDate.getTime() + Math.random()),
	socketID: null,
	playlistInstance: null,
	playing: false,
	playerSocket: null,
	playlistMaxEntries: 500,
	playerElement: '#remoMusicPlayer',
	lastFmApiKey: 'f2923bd087687602324332057ed0473a',
	initialMusic: initialPlaylist
};

//Player init
masterPlayer.playerInit = function(callback){
	var _self = this;

	//Start controls
	this.menuControl();

	//Start player
	this.newPlayerInstance = function(callback){
		this.config.playlistInstance = new jPlayerPlaylist({
				jPlayer: this.config.playerElement,
				cssSelectorAncestor: "#jp_container"
			}, 
			this.config.initialMusic, {
			playlistOptions: {
				enableRemoveControls: false,
				loopOnPrevious: true,
				displayTime: 0,
				addTime: 0,
				removeTime: 0,
				shuffleTime: 0
			},
			smoothPlayBar: false,
			preload: 'metadata',
			volume: 0.8,
			errorAlerts: false,
			solution: "html",
			warningAlerts: false,
			keyEnabled: false,
			play: function(a){
				//Save orderId in localstorage 
				if(masterPlayer.config.playlistInstance.playlist[masterPlayer.config.playlistInstance.current].orderId)
					savedUserInfo.set('playlist.play', masterPlayer.config.playlistInstance.playlist[masterPlayer.config.playlistInstance.current].orderId);

				//Scroll to music
				$('.jp-playlist').stop().animate({
						scrollTop: (41) * (masterPlayer.config.playlistInstance.current - 2)
				});

				//Set play
				masterPlayer.config.playing = true;

				//Get and set Music info
				masterPlayer.setMusicInfo(masterPlayer.config.playlistInstance.playlist[masterPlayer.config.playlistInstance.current]);
			},
			pause: function() {
				//Set play
				masterPlayer.config.playing = false;
			},
			seeking: function(a){
				//Analytics
				analytics.track('musicProgress', 'click');
			},
			volumechange: function(a, b) {

				//Muted?
				if($(masterPlayer.config.playerElement).jPlayer('option', 'muted') == true) {
					//Save
					savedUserInfo.set('playlist.volume', 0);
				} else {
					//Save
					savedUserInfo.set('playlist.volume', $(masterPlayer.config.playerElement).jPlayer('option', 'volume'));
				}

				//Analytics
				if(typeof analytics != 'undefined') //For first volume bind
					analytics.track('volume', 'click');
			}
		});

		//Callback
		if(typeof callback == 'function') {
			callback.call(this);
		}
	};

	//Playlist config
	savedUserInfo.get('playlist.entries', function(playlist){
		var isReady = false;
		var count = 0;

		if(playlist && yepnope.tests.chromeApp() && yepnope.tests.chrome.restorable()){

			//Is too much? Performance issue ///TODO: Passar para quando adiciona músicas, criar alerta
			if(playlist.length > masterPlayer.config.playlistMaxEntries){
				isReady = true;
			} else {

				masterPlayer.config.initialMusic = [];

				//Pass playlist array
				for(var i = 0; i < playlist.length; i++){
					(function(i, playlistItem){

						//Verify if is restorable ID
						chrome.fileSystem.isRestorable(playlistItem.id, function( isRestorable ) {

							if(isRestorable === true) {

								//Restore the file
								chrome.fileSystem.restoreEntry(playlistItem.id, function( entry ) {

									entry.file(function(file) {
									 	count++;

									 	//Insert in list
										masterPlayer.config.initialMusic.push($.extend({}, playlistItem, {mp3: window.URL.createObjectURL(file)}));

										//Its ready?
										if(count >= playlist.length) {
											isReady = true;
										}
									});

								});
							} else {
								count++;

								//Its ready?
								if(count >= playlist.length) {
									isReady = true;
								}
							}
						});
					})(i, playlist[i]);
				
				}
			}
		} else {isReady = true;}

		var readyToGo = function(){
			if(isReady) {
				//Remove playlist loading indicator
				$('#playlist').removeClass('loading');

				//Set playlist
				if(masterPlayer.config.initialMusic.length == 0) { masterPlayer.config.initialMusic = initialPlaylist;}
				masterPlayer.config.playlistInstance.setPlaylist(masterPlayer.config.initialMusic);

				//Get last music played
				savedUserInfo.get('playlist.play', function(orderId){
					if(orderId) {
						for(var item in masterPlayer.config.playlistInstance.playlist) {
							if(masterPlayer.config.playlistInstance.playlist[item].orderId == orderId) {
								masterPlayer.config.playlistInstance.select(Number(item));
								
								//TRICK: execute the play function and callbacks
								masterPlayer.config.playlistInstance.play();
								masterPlayer.config.playlistInstance.pause();
								return false;
							}
						
						}
					}
				});
				
			}
			else {
				setTimeout(function(){
					readyToGo();
				}, 1000);
			}
		};

		//New player
		_self.newPlayerInstance(callback);
		readyToGo(isReady);
	});
	
	//Binds
	this.keyboardEvents();
	this.mouseEvents();
	this.applyAnalytics();

	//Volume config
	savedUserInfo.get('playlist.volume', function(volume) {
		if(parseFloat(volume) == 0) {
			$(masterPlayer.config.playerElement).jPlayer('option','muted', true);
		} else {
			$(masterPlayer.config.playerElement).jPlayer('option','volume', parseFloat(volume));
		}
	});
};

//Menu control
masterPlayer.menuControl = function() {
	//On click in open files
	$('.menu-open-files').on('click', function(){
		//$('#open-files').trigger('click');

		chrome.fileSystem.chooseEntry({type: 'openFile', acceptsMultiple: true, accepts: [{description: 'Audio (mp3 or ogg)', mimeTypes:['audio/mp3', 'audio/ogg', 'audio/mpeg']}]}, function(items) {
			masterPlayer.fileTreeReader(items, function () {
				masterPlayer.config.playlistInstance.play();
			});
		});
	});

	//On open folder
	$('#open-files').on('change', function(event){
		masterPlayer.fileTreeReader(event.target.files, function () {
			masterPlayer.config.playlistInstance.play();
		});
	});

	//Open credits
	$('.menu-info').on('click', function(){
		window.location.hash = 'credits';
	});

	//Open equalizer
	$('.menu-equalizer').on('click', function(){
		window.location.hash = 'equalizer';
	});
};

//Set album cover
masterPlayer.setAlbumCover = function (src) {
	var oldImage = $('.jp-music-cover img'),
			backupImage = oldImage.attr('src'),
			backupWidth = oldImage.attr('width'),
			backupHeight = oldImage.attr('height'),
			newImage = document.createElement('img');

	newImage.src = src;
	newImage.setAttribute('width', backupWidth);
	newImage.setAttribute('height', backupHeight);
	oldImage.remove();
	$(newImage)
		.appendTo('.jp-fake-image')
		.css({ 'opacity': 0.01, 'display': 'block' });

	newImage.onload = function () {
		$(newImage).animate({ 'opacity': 1 }, 600, function () {
			$('.jp-fake-image').css('background-image', 'url("' + src + '")');
		});
	};
};

//Grab album cover from WEB or file and put in player
masterPlayer.grabAlbumCover = function (ID3) {
	var _self = this;

	//info.title and info.artist required; info.album prefer
	if(yepnope.tests.online()) {
		
		//Get album info
		$.ajax({
			url: 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=' + masterPlayer.config.lastFmApiKey + '&artist=' + ID3.artist + '&track=' + ID3.title + '&format=json',
			cache: true,
			success: function(result) {
				if(!result.error && typeof result.track.album != 'undefined') {
					//Create new image  (for get onload callback)
					//Create a blob file for packaged apps (see more at: http://developer.chrome.com/apps/app_external.html#objecttag)
					if(typeof chrome != 'undefined' && typeof chrome.app.runtime != 'undefined') {
						var xhr = new XMLHttpRequest();
						xhr.open('GET', result.track.album.image[1]['#text'], true);
						xhr.responseType = 'blob';

						xhr.onerror = function(e, o){
							console.log(this);
							console.log(e);
							console.log(o);
						};

						xhr.onload = function(e) {
							_self.setAlbumCover(window.webkitURL.createObjectURL(this.response));
						};

						xhr.send();
					} 

					//Normal flow for create image
					else {
						_self.setAlbumCover(result.track.album.image[1]['#text']);
					}

				} else {
					$('.jp-fake-image').css('background-image','none');
					$('.jp-music-cover img').animate({'opacity': 0.01}, 600);
				}
			}
		});
	}
};

//Music info
masterPlayer.setMusicInfo = function(music) {
	if(typeof music.file == 'object') {
		var reader = new FileReader();
		reader.readAsArrayBuffer(music.file);

		reader.onload = function(e) {
			var dv = new jDataView(this.result);
			var ID3 = {};

			//If dont load, use this information
			var fileName = music.file.name.replace(".mp3","");
			var title = fileName;
			var artist = null;
			if(fileName.split(' - ').length >= 2) {
				title = fileName.split(' - ')[1];
				artist = fileName.split(' - ')[0];
			}

			// "TAG" starts at byte -128 from EOF.
			// See http://en.wikipedia.org/wiki/ID3
			if (dv.getString(3, dv.byteLength - 128) == 'TAG') {
				ID3 = {
					title: dv.getString(30, dv.tell()),
					artist: dv.getString(30, dv.tell()),
					album: dv.getString(30, dv.tell()),
					year: dv.getString(4, dv.tell()),
					file: music.file
				};

			}

			//If wont find ID3
			else {
				ID3 = {
					title: title,
					artist: artist,
					album: '',
					file: music.file,
					year: ''
				};
			}

			//More verifications
			if($.trim(ID3.title).charCodeAt(0) == 0)
				ID3.title = title;

			if($.trim(ID3.artist).charCodeAt(0) == 0)
				ID3.artist = artist;

			//Set artist and title
			$('.jp-music-name').html(ID3.title);
			$('.jp-music-artist').html(ID3.artist);

			//Get album info
			masterPlayer.grabAlbumCover(ID3);
		};
	} else {
		var ID3 = {
			title: music.title,
			artist: music.artist,
			file: music.file,
			album: '',
			year: ''
		};

		//Set artist and title
		$('.jp-music-name').html(ID3.title);
		$('.jp-music-artist').html(ID3.artist);


		//Get album info
		masterPlayer.grabAlbumCover(ID3);
	}
};

//Save playlist to read later
masterPlayer.savePlaylist = function(playList){

	//Grant access to the file history
	if(yepnope.tests.chromeApp() &&  yepnope.tests.chrome.restorable()) {
		for (var i = 0; i < playList.length; i++) {
			if(typeof playList[i].fileEntry != 'undefined') {
				playList[i].id = chrome.fileSystem.retainEntry(playList[i].fileEntry);
			}
		}
	}

	//Save playlist
	savedUserInfo.set('playlist.entries', playList);
};

//FileTree reader
masterPlayer.fileTreeReader = function(files, callback){
	var playList = [],
		timeOutForDone = -1;

	//Filesystem for trees
	function traverseItemTree(fileEntry, path) {
		path = path || "";
		if (fileEntry.isFile) {
			// Get file
			fileEntry.file(function(file) {
				traverseFileTree(file, fileEntry);
			});
		} else if (fileEntry.isDirectory) {
			// Get folder contents
			var dirReader = fileEntry.createReader();
			dirReader.readEntries(function(entries) {
				for (var i=0; i<entries.length; i++) {
					traverseItemTree(entries[i], path + fileEntry.name + "/");
				}
			});
		}
	}

	//Filesystem for upload trees
	function traverseFileTree(file, fileEntry) {
		console.log('File Traverser - ','file:', file,'filetype:', file.type, 'file.contentType:', file.contentType);
		
		if(
			file.type === 'audio/mp3' 			|| 
			file.type === 'audio/mpeg' 			|| 
			file.type === 'audio/ogg' 			||
			file.type === 'audio/x-m4a'			||
			file.contentType === 'audio/mpeg' 	|| 
			file.contentType === 'audio/ogg'
		) {
			var fileName = file.name.replace(".mp3","").replace(".mp4","").replace(".m4a","").replace(".ogg","");
			var title = fileName;
			var artist = null;
			
			if(fileName.split(' - ').length >= 2) {
				title = fileName.split(' - ')[1];
				artist = fileName.split(' - ')[0];
			}

			playList.push({
				title: title,											//Title of music
				artist: artist,											//Artist
				file: file,												//The file of mp3
				fileEntry: fileEntry,									//The entry file
				mp3: window.URL.createObjectURL(file),					//The converted BLOB
				orderId: new Date().getTime() + (Math.random() * 1000)	//UniqueID
			});

			clearTimeout(timeOutForDone);
			timeOutForDone = setTimeout( function(){
				if(playList.length) {
					//Save playlist
					masterPlayer.savePlaylist(playList);

					//Play the playlist
					masterPlayer.config.playlistInstance.setPlaylist(playList);
					if (typeof callback == 'function') {
						callback.call(this);
					}
				}
			}, 200);
		} else {
			//Your file is not supported.
		}
	}

	//Detect
	for (var i=0; i < files.length; i++) {
		if(typeof files[i].webkitGetAsEntry == 'function') {
			var item = files[i].webkitGetAsEntry();
			if (item) {
				traverseItemTree(item);
			}
		} else {
			traverseItemTree(files[i]);
		}
	}
};

//FileReader
masterPlayer.fileReaderInit = function() {
	//Music listener with fileReader
	var dropTarget = $('#drag-drop-layer'),
		html = $('html'),
		showDrag = false,
		timeout = -1;

	$('html')
		//On drag enter
		.on('dragenter', function(event){
			dropTarget.addClass('hover');
			showDrag = true;
		})

		//On drag over
		.on('dragover', function(event){
			event.preventDefault();
			showDrag = true;
		})

		//On drag leave
		.on('dragleave', function(event){
			showDrag = false;
			clearTimeout(timeout);
			timeout = setTimeout(function(){
				if(!showDrag)
					dropTarget.removeClass('hover');
			}, 200);
		})

		//On drop files or folders
		.on('drop', function(event){
			//Prevent default actions
			event.preventDefault();
			event.stopPropagation();

			//Hide layer
			$('#drag-drop-layer').removeClass('hover');

			var items = event.dataTransfer ? event.dataTransfer.items : (event.originalEvent.dataTransfer.items || event.originalEvent.dataTransfer.files);

			masterPlayer.fileTreeReader(items, function () {
				masterPlayer.config.playlistInstance.play();
			});

			return false;
		});
};

//Bind keyboard events
masterPlayer.keyboardEvents = function(){
	$('body').on('keydown.musicControl', function(event){

		switch(event.keyCode) {
			//Play or pause
			case 80: //p
			case 32: //space
			case 179: //Multimidia keyboard
				if(masterPlayer.config.playing) {
					masterPlayer.config.playlistInstance.pause();
					analytics.track('pauseMusic', 'keyboard', event.keyCode);
				}
				else {
					masterPlayer.config.playlistInstance.play();
					analytics.track('playMusic', 'keyboard', event.keyCode);
				}
				return false;
				event.preventDefault();
			break;

			//Next music
			case 39: //Right arrow
			case 40: //Bottom arrow
			case 176: //Multimidia keyboard
				masterPlayer.config.playlistInstance.next();
				analytics.track('nextMusic', 'keyboard', event.keyCode);
				return false;
				event.preventDefault();
			break;

			//previous music
			case 37: //Left arrow
			case 38: //Up arrow
			case 177: //Multimidia keyboard
				masterPlayer.config.playlistInstance.previous();
				analytics.track('prevMusic', 'keyboard', event.keyCode);
				return false;
				event.preventDefault();
			break;
		}
	});
};

//Apply analytics events
masterPlayer.applyAnalytics = function() {
	//Play music
	//See keyboard events at masterPlayer.keyBoardEvents
	$('.jp-play').on('click', function(){
		analytics.track('playMusic', 'click');
	});

	//Pause music
	//See keyboard events at masterPlayer.keyBoardEvents
	$('.jp-pause').on('click', function(){
		analytics.track('pauseMusic', 'click');
	});

	//Next music
	//See keyboard events at masterPlayer.keyBoardEvents
	$('.jp-next').on('click', function(){
		analytics.track('nextMusic', 'click');
	});

	//Previous music
	//See keyboard events at masterPlayer.keyBoardEvents
	$('.jp-previous').on('click', function(){
		analytics.track('prevMusic', 'click');
	});

	//Shuffle
	$('.jp-shuffle').on('click', function(){
		analytics.track('suffle', 'on');
	});
	$('.jp-shuffle-off').on('click', function(){
		analytics.track('suffle', 'off');
	});

	//Repeat
	$('.jp-repeat').on('click', function(){
		analytics.track('repeat', 'on');
	});
	$('.jp-repeat-off').on('click', function(){
		analytics.track('repeat', 'off');
	});

	//Music progress
	//See event at masterPlayer.init: seeking event

	//Mute
	$('.jp-mute').on('click', function(){
		analytics.track('mute', 'on');
	});
	$('.jp-unmute').on('click', function(){
		analytics.track('mute', 'off');
	});

	//Volume Change
	//See event at masterPlayer.init: volumechange event

	//Chrome actions
	//See events at masterPlayer: chromeWebInit and chromeApp.js

	//qrCode actions
	//See events at masterPlayer.qrCodeInt

	//Change music
	$('#playlist').on('click', 'li:not(.jp-playlist-current)', function(){
		analytics.track('changeMusic', 'click');
	});

	//Open files
	$('.menu-open-files').on('click', function(){
		analytics.track('openFiles', 'click');
	});

	//About
	$('.menu-info').on('click', function(){
		analytics.track('openAbout', 'click');
	});
};

//Bind mouse events
masterPlayer.mouseEvents = function(){
	//Hide elements when mouse dont move
	var mousemovePID = this.hideOnMouseMove(true);

	$('html').on('mousemove touchstart', function () {
		masterPlayer.hideOnMouseMove(false);
		clearTimeout(mousemovePID);
		mousemovePID = masterPlayer.hideOnMouseMove(true);
	});
};

//Hide elements on mouse move
masterPlayer.hideOnMouseMove = function(hide){
	if(hide) {
		return setTimeout(function(){
			$('#show-QR-code, #menu, .jp-volume').addClass('hidden');
		}, 10000);
	} else {
		$('#show-QR-code, #menu, .jp-volume').removeClass('hidden');
	}
};