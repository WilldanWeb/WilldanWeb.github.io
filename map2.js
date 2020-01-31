'use strict';

(function() {
	// Constants
	var dotColorUnselected = '#003865';
	var dotColorSelected = '#43b02a';
	var localZoom = 10;
	var boundsPadding = 12;

	var dotImgUnselected = svgDotImg( dotColorUnselected );
	var dotImgSelected = svgDotImg( dotColorSelected );

	var $sidebar, $sidepanel, $map, map, usBounds;
	var data = {};
	var info, markerIconUnselected, markerIconSelected;

	function svgDotImg( color ) {
		var size = 16;
		var svg = str(
			'<svg xmlns="http://www.w3.org/2000/svg" width="', size, 'px" height="', size, 'px" viewBox="0 0 ', size+4, ' ', size+4, '">',
			  '<circle cx="', size/2, '" cy="', size/2+4, '" r="', size/2, '" fill="', color, '" stroke="white" />',
			'</svg>'
		);
		return str(
			'<img src="data:image/svg+xml,',
				encodeURIComponent(svg),
			'">'
			//'" style="width:', size, 'px; height:', size, 'px; margin-right:2px; margin-top: -5px;">'
		);
	}

	function str() {
		return Array.prototype.join.call( arguments, '' );
	}

	function mapJoin( array, fun ) {
		return array.map( fun ).join('');
	}

	function loadMap() {
		$( function() {
			CSV.fetch({ url: 'https://WilldanWeb.github.io/offices.csv' }).done( initMap );
		});
	}

	function initMap( csv ) {
		initData( csv );
		// TODO: combine these two inits
		markerIconUnselected = {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 8,
			fillColor: dotColorUnselected,
			fillOpacity: 1,
			strokeColor: '#FFF',
			strokeOpacity: 1,
			strokeWeight: 1,
		};
		markerIconSelected = {
			path: google.maps.SymbolPath.CIRCLE,
			scale: 11,
			fillColor: dotColorSelected,
			fillOpacity: 1,
			strokeColor: '#FFF',
			strokeOpacity: 1,
			strokeWeight: 2,
		};

		$sidebar = $('#map-sidebar');
		$sidepanel = $('#map-sidepanel');
		$map = $('#map-content');
		map = new google.maps.Map( $map[0], {
			fullscreenControl: false,
			mapTypeControl: false,
			rotateControl: false,
			streetViewControl: false,
			styles: officeMap.mapStyle,
			zoomControl: wantZoomControl(),
		});

		usBounds = new google.maps.LatLngBounds();
		data.states.forEach( function( state ) {
			state.bounds = new google.maps.LatLngBounds;
			state.offices.forEach( function( office ) {
				var latLng = new google.maps.LatLng( office.lat, office.lng );
				usBounds.extend( latLng );
				state.bounds.extend( latLng );
				var marker = office.marker = new google.maps.Marker({
					map: map,
					position: latLng,
					title: str(
						office.name, ' Office\n',
						office.address, '\n',
						office.office, ' ', office.zip
					),
					icon: markerIconUnselected,
				});
				marker.addListener( 'mouseover', function() {
					marker.setIcon( markerIconSelected );
				});
				marker.addListener( 'mouseout', function() {
					marker.setIcon(
						office === data.currentOffice ?
							markerIconSelected :
							markerIconUnselected
					);
				});
				marker.addListener( 'click', function() {
					viewOffice( office.id );
				});
			});
		});
		map.fitBounds( usBounds, boundsPadding );
		// map.addListener( 'click', function() {
		// 	viewAllStates();
		// });
		updateView( history.state, true );
		window.addEventListener( 'popstate', function( event ) {
			updateView( event.state, false );
		});
	}

	function updateView( s, loading ) {
		if( ! s ) {
			if( loading ) {
				viewAllStates();
			} else {
				history.back();
			}
		} else if( s.office ) {
			viewOffice( s.office, true );
		} else if( s.state ) {
			viewState( s.state, true );
		} else {
			viewAllStates( false, true );
		}
	}

	function namedRow( fields, record ) {
		var row = {};
		for( var i = 0;  i < fields.length;  ++i ) {
			row[fields[i]] = record[i];
		}
		return row;
	}

	function initData( csv ) {
		var offices = csv.records.map( function( record ) {
			var row = namedRow( csv.fields, record );
			return {
				office: row.Office,
				address: row.Address,
				city: row.City,
				state: row.State,
				st: row.ST,
				zip: row.Zip,
				phone: row.MainPhone,
				tollfree: row.Tollfree,
				fax: row.Fax,
				email: row.Email,
				map: row.GoogleMyBusinessPlace,
				placeId: row.GooglePlaceID,
				lat: +row.Latitude,
				lng: +row.Longitude
			};
		});
		$.extend( data, {
			offices: offices,
			officesByState: {},
			states: [],
			statesByName: {},
		});
		data.offices.forEach( function( office, id ) {
			office.id = id;
			office.name = office.office
				.replace( /, [A-Z][A-Z]/, '' )
				.replace( '(', '- ' )
				.replace( ')', '' );
			var state = data.statesByName[office.state];
			if( ! state ) {
				state = data.statesByName[office.state] = {
					name: office.state,
					offices: [],
				};
				data.states.push( state );
			}
			office.state = state;
			state.offices.push( office );
		});
		data.states.sort( function( a, b ) { return a.name.localeCompare(b.name); } );
		data.states.forEach( function( state, id ) {
			state.id = id;
			state.offices.sort( function( a, b ) { return a.office.localeCompare(b.office); } );
		});
	}

	function setSidebar() {
		$sidepanel.html( str.apply( null, arguments ) );
	}

	function formatInfoWindow( office ) {
		var email = '';
		
			email = str(
				'<div class="map-info-email">',
					'<img src="https://WilldanWeb.github.io/EnvelopeFill.svg"/>',
					'<a href="http://willdan.com/email2.aspx?Name=', office.email, '&Page=', encodeURIComponent(office.office), '">',
						'Email',
					'</a>',
				'</div>'
			);
		
		var phone = ! office.phone ? '' :
			str( '<div class="map-info-phone">', 'Phone: ', office.phone, '</div>' );
		var tollfree = ! office.tollfree ? '' :
			str( '<div class="map-info-phone">', 'Phone: ', office.tollfree, '</div>' );
		var fax = ! office.fax ? '' :
			str( '<div class="map-info-fax">', 'Fax: ', office.fax, '</div>' );
		var query = str(
			office.address, ', ', office.city, ', ', office.st, ' ', office.zip
			// office.lat, ',', office.lng
		);
		var url = office.map || str(
			'https://www.google.com/maps/search/?api=1&query=',
			encodeURIComponent(query).replace( '%20', '+' ),
			office.place_id ? str( '&query_place_id=', office.place_id ) : ''
		);
		return str(
			'<div class="map-info-office">', dotImgSelected, office.name, ' Office</div>',
			'<div class="map-info-address">', office.address, '</div>',
			'<div class="map-info-city-state-zip">', office.city, ', ', office.st, ' ', office.zip, '</div>',
			phone,
			tollfree,
			fax,
			email,
			'<div class="map-info-directions">','<img src="https://WilldanWeb.github.io/LocationFill.svg"/>',
				'<a href="', url, '" target="_blank">Directions</a>',
			'</div>'
		);
	}

	function closeInfoWindow() {
		if( info ) info.close();
		info = undefined;
	}

	function officesByStateButton() {
		return str(
			'<div onclick="OfficeMap.viewAllStates()" class="map-sidebar-states"><span>View All States</span></div>'
		);
	}

	function stateButton( state, classname ) {
		var count = state.offices.length;
		return str(
			'<div onclick="OfficeMap.viewState(', state.id, ')" class="map-sidebar-state ', classname, '">',
				state.name,
				count > 1 ? ' (' + count + ')' : '',
			'</div>'
		);
	}

	function viewAllStates( skipFit, popping ) {
		if( ! popping ) {
			history.pushState( {}, 'View All States' );
		}
		data.currentState = data.currentOffice = null;
		setSidebar(
			officesByStateButton(),
			'<div class="map-sidebar-scrolling">',
				mapJoin( data.states, function( state ) {
					return stateButton( state, 'map-sidebar-state-list' );
				}),
			'</div>'
		);
		setMarkerIcons();
		if( ! skipFit ) {
			map.fitBounds( usBounds, boundsPadding );
		}
	}

	function viewState( id, popping ) {
		var state = data.states[id];
		data.currentState = state;
		data.currentOffice = null;
		if( state.offices.length === 1 ) {
			viewOffice( state.offices[0].id );
		} else {
			if( ! popping ) {
				history.pushState( { state: id }, state.name + ' Offices' );
			}
			var count = state.offices.length;
			setSidebar(
				officesByStateButton(),
				'<div class="map-sidebar-scrolling">',
					'<div class="map-sidebar-state">',
						state.name,
						count > 1 ? ' (' + count + ')' : '',
					'</div>',
					mapJoin( state.offices, function( office ) {
						return str(
							'<div onclick="OfficeMap.viewOffice(', office.id, ')" class="map-sidebar-list-office">',
								dotImgUnselected,
								office.name,
							'</div>'
						);
					}),
				'</div>'
			);
			setMarkerIcons();
			// if( map.getZoom() < localZoom ) {
				setTimeout( function() {
					map.panTo( state.bounds.getCenter() );
					var idler = map.addListener( 'idle', function() {
						idler.remove();
						setTimeout( function() {
							// map.setZoom( localZoom );
							map.fitBounds( state.bounds, boundsPadding * 2 );
						}, 200 );
					});
				}, 200 );
			// }
		}
	}

	function viewOffice( id, popping ) {
		var office = data.offices[id];
		if( ! popping ) {
			history.pushState( { office: id }, office.name + ' Office' );
		}
		data.currentState = null;
		data.currentOffice = office;
		setSidebar(
			officesByStateButton(),
			stateButton( office.state, 'map-sidebar-state-button' ),
			'<div class="map-sidebar-scrolling">',
				'<div class="map-sidebar-office">',
					formatInfoWindow( office ),
				'</div>',
			'</div>'
		);
		setMarkerIcons( office );
		if( map.getZoom() < localZoom ) {
			setTimeout( function() {
				map.panTo( office );
				var idler = map.addListener( 'idle', function() {
					idler.remove();
					setTimeout( function() {
						map.setZoom( localZoom );
					}, 200 );
				});
			}, 200 );
		}
	}

	function setMarkerIcons( officeSelected ) {
		data.offices.forEach( function( office ) {
			office.marker.setIcon(
				office === officeSelected ? markerIconSelected : markerIconUnselected
			);
		});
	}

	// TODO dynamic on resize?
	function wantZoomControl() {
		return window.innerWidth > 350  &&  window.innerHeight > 350
	}

	window.OfficeMap_loadMap = loadMap;

	window.OfficeMap = {
		viewAllStates: viewAllStates,
		viewState: viewState,
		viewOffice: viewOffice,
		data: data
	};

})();
