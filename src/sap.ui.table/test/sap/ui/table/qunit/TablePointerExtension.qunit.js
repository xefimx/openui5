//************************************************************************
// Test Code
//************************************************************************

sap.ui.test.qunit.delayTestStart(500);


QUnit.module("Initialization", {
	setup: function() {
		createTables();
	},
	teardown: function () {
		destroyTables();
	}
});

QUnit.test("init()", function(assert) {
	var oExtension = oTable._getPointerExtension();
	assert.ok(!!oExtension, "Pointer Extension available");

	var iCount = 0;
	for (var i = 0; i < oTable.aDelegates.length; i++) {
		if (oTable.aDelegates[i].oDelegate === oExtension._delegate) {
			iCount++;
		}
	}
	assert.ok(iCount == 1, "Pointer Delegate registered");
});


QUnit.module("VisibleRowCountMode 'Interactive'", {
	setup: function() {
		jQuery.sap.byId("content").toggleClass("StablePosition", true);
		createTables(true);
		oTable.placeAt("content");
		oTable.setVisibleRowCountMode("Interactive");
		sap.ui.getCore().applyChanges();
	},
	teardown: function () {
		destroyTables();
		jQuery.sap.byId("content").toggleClass("StablePosition", false);
	}
});

QUnit.test("resize", function(assert) {
	function testAdaptations(bDuringResize) {
		assert.equal(jQuery.sap.byId(oTable.getId() + "-rzoverlay").length, bDuringResize ? 1 : 0, "The handle to resize overlay is" + (bDuringResize ? "" : " not") + " visible");
		assert.equal(jQuery.sap.byId(oTable.getId() + "-ghost").length, bDuringResize ? 1 : 0, "The handle to resize ghost is" + (bDuringResize ? "" : " not") + " visible");

		var oEvent = jQuery.Event({type : "selectstart"});
		oEvent.target = oTable.getDomRef();
		$Table.trigger(oEvent);
		assert.ok(oEvent.isDefaultPrevented() && bDuringResize || !oEvent.isDefaultPrevented() && !bDuringResize, "Prevent Default of selectstart event");
		assert.ok(oEvent.isPropagationStopped() && bDuringResize || !oEvent.isPropagationStopped() && !bDuringResize, "Stopped Propagation of selectstart event");
		var sUnselectable = jQuery(document.body).attr("unselectable") || "off";
		assert.ok(sUnselectable == (bDuringResize ? "on" : "off"), "Text Selection switched " + (bDuringResize ? "off" : "on"));
	}

	var $Table = oTable.$();
	var $Resizer = $Table.find('.sapUiTableHeightResizer');
	var iInitialHeight = $Table.height();
	var iY = $Resizer.offset().top;

	assert.equal($Resizer.length, 1, "The handle to resize the table is visible");
	assert.equal($Table.offset().top, 0, "Initial Offset");
	assert.equal(oTable.getVisibleRowCount(), 5, "Initial visible rows");
	testAdaptations(false);

	qutils.triggerMouseEvent(oTable.$("sb"), "mousedown", 0, 0, 10, iY, 0);
	for (var i = 0; i < 10; i++) {
		iY += 10;
		qutils.triggerMouseEvent($Table, "mousemove", 0, 0, 10, iY, 0);
		if (i == 5) { // Just check somewhere in between
			testAdaptations(true);
		}
	}
	qutils.triggerMouseEvent($Table, "mouseup", 0, 0, 10, iY + 10, 0);
	// resized table by 110px, in cozy mode this allows 2 rows to be added
	assert.equal(oTable.getVisibleRowCount(), 7, "Visible rows after resize");
	assert.ok(iInitialHeight < $Table.height(), "Height of the table increased");
	testAdaptations(false);
});

QUnit.module("Column Resizing", {
	setup: function() {
		this.bOriginalSystemDesktop = sap.ui.Device.system.desktop;

		jQuery.sap.byId("content").toggleClass("StablePosition", true);
		createTables(true);
		oTable.placeAt("content");

		// Ensure that the last column is "streched" and the others have their defined size
		var oLastColumn = oTable.getColumns()[oTable.getColumns().length - 1];
		oLastColumn.setWidth(null);

		// Ensure bigger cell content for the column with index 1
		var aRows = oModel.getData().rows;
		for (var i = 0; i < aRows.length; i++) {
			aRows[i][aFields[1]] = "AAAAAAAAAAAAAAAAAAAAAAAAA" + i;
		}
		oModel.refresh(true);

		this.oColumn = oTable.getColumns()[1];
		this.oColumn.setResizable(false);

		sap.ui.getCore().applyChanges();

		// Extend auto resize logic to know about the test control
		sap.ui.table.TablePointerExtension._fnCheckTextBasedControl = function(oControl) {
			return oControl.getMetadata().getName() === "TestControl";
		};
	},
	teardown: function () {
		sap.ui.Device.system.desktop = this.bOriginalSystemDesktop;

		destroyTables();
		jQuery.sap.byId("content").toggleClass("StablePosition", false);
		sap.ui.table.TablePointerExtension._fnCheckTextBasedControl = null;
	}
});

function moveResizer(oColumn, assert, bExpect, iIndex) {
	qutils.triggerEvent("mousemove", oColumn.getId(), {
		clientX : Math.floor(oColumn.getDomRef().getBoundingClientRect().left + 10),
		clientY : Math.floor(oColumn.getDomRef().getBoundingClientRect().top + 100)
	});

	if (assert) {
		var bCorrect = Math.abs(parseInt(oTable.$("rsz").css("left")) - 100 - oColumn.getDomRef().getBoundingClientRect().left) < 5;
		assert.ok(bExpect && bCorrect || !bExpect && !bCorrect, "Position of Resizer");
		assert.equal(oTable._iLastHoveredColumnIndex, iIndex, "Index of last hovered resizable table");
	}
}

QUnit.test("Moving Resizer", function(assert){
	var aVisibleColumns = oTable._getVisibleColumns();
	moveResizer(aVisibleColumns[0], assert, true, 0);
	moveResizer(aVisibleColumns[1], assert, false, 0);
	assert.ok(Math.abs(parseInt(oTable.$("rsz").css("left")) - 100 - aVisibleColumns[0].getDomRef().getBoundingClientRect().left) < 10, "Position of Resizer still on column 0");
	moveResizer(aVisibleColumns[2], assert, true, 2);

});

QUnit.asyncTest("Automatic Column Resize via Double Click", function(assert){
	sap.ui.Device.system.desktop = true;

	function triggerDoubleClick(bExpect, iIndex) {
		// Move resizer to correct column
		moveResizer(oColumn, assert, bExpect, iIndex)
		// Double Click on resizer
		qutils.triggerMouseEvent(oTable.$("rsz"), "dblclick");
	}

	var oColumn = this.oColumn;
	assert.ok(!oColumn.getAutoResizable(), "Column is not yet autoresizable");
	assert.ok(!oColumn.getResizable(), "Column is not yet resizable");

	var iWidth = oColumn.$().width();
	assert.ok(Math.abs(iWidth - 100) < 10, "check column width before resize: " + iWidth);
	triggerDoubleClick(false, 0);

	setTimeout(function() {
		assert.equal(oColumn.$().width(), iWidth, "check column width after resize: " + iWidth);
		oColumn.setAutoResizable(true);
		sap.ui.getCore().applyChanges();
		assert.ok(oColumn.getAutoResizable(), "Column is autoresizable");
		assert.ok(!oColumn.getResizable(), "Column is not yet resizable");
		triggerDoubleClick(false, 0);

		setTimeout(function() {
			assert.equal(oColumn.$().width(), iWidth, "check column width after resize: " + iWidth);
			oColumn.setResizable(true);
			sap.ui.getCore().applyChanges();
			assert.ok(oColumn.getAutoResizable(), "Column is autoresizable");
			assert.ok(oColumn.getResizable(), "Column is resizable");
			sap.ui.Device.system.desktop = false;
			triggerDoubleClick(true, 1);

			setTimeout(function() {
				assert.equal(oColumn.$().width(), iWidth, "check column width after resize: " + iWidth);

				sap.ui.Device.system.desktop = true;
				triggerDoubleClick(true, 1);

				setTimeout(function() {
					iWidth = oColumn.$().width();
					assert.ok(Math.abs(iWidth - 270) < 40, "check column width after resize: " + iWidth);
					start();
				}, 50);
			}, 50);
		}, 50);
	}, 50);
});

QUnit.asyncTest("Automatic Column Resize via API", function(assert){
	var oColumn = this.oColumn;
	assert.ok(!oColumn.getAutoResizable(), "Column is not yet autoresizable");
	assert.ok(!oColumn.getResizable(), "Column is not yet resizable");

	var iWidth = oColumn.$().width();
	assert.ok(Math.abs(iWidth - 100) < 10, "check column width before resize: " + iWidth);
	oTable.autoResizeColumn(1);

	setTimeout(function() {
		assert.equal(oColumn.$().width(), iWidth, "check column width after resize: " + iWidth);
		oColumn.setAutoResizable(true);
		sap.ui.getCore().applyChanges();
		assert.ok(oColumn.getAutoResizable(), "Column is autoresizable");
		assert.ok(!oColumn.getResizable(), "Column is not yet resizable");
		oTable.autoResizeColumn(1);

		setTimeout(function() {
			assert.equal(oColumn.$().width(), iWidth, "check column width after resize: " + iWidth);
			oColumn.setResizable(true);
			sap.ui.getCore().applyChanges();
			assert.ok(oColumn.getAutoResizable(), "Column is autoresizable");
			assert.ok(oColumn.getResizable(), "Column is resizable");
			oTable.autoResizeColumn(1);

			setTimeout(function() {
				iWidth = oColumn.$().width();
				assert.ok(Math.abs(iWidth - 270) < 40, "check column width after resize: " + iWidth);
				start();
			}, 50);
		}, 50);
	}, 50);
});

QUnit.asyncTest("Resize via Drag&Drop", function(assert) {
	var oColumn = this.oColumn;
	var $Resizer = oTable.$("rsz");

	// resizer should be way out of screen when the table gets rendered
	assert.equal(oTable.$("rsz").position().left, "0", "Resizer is at the correct initial position");

	assert.ok(!oColumn.getAutoResizable(), "Column is not yet autoresizable");
	assert.ok(!oColumn.getResizable(), "Column is not yet resizable");

	var iWidth = oColumn.$().width();
	assert.ok(Math.abs(iWidth - 100) < 10, "check column width before resize: " + iWidth);

	// Resizer moved to the correct position when column is resizable
	moveResizer(oColumn, assert, false, 0);
	oColumn.setAutoResizable(true);
	sap.ui.getCore().applyChanges();
	moveResizer(oColumn, assert, false, 0);
	oColumn.setResizable(true);
	sap.ui.getCore().applyChanges();
	moveResizer(oColumn, assert, true, 1);

	// drag resizer to resize column
	var $Resizer = oTable.$("rsz");
	var iResizeHandlerTop = Math.floor(oColumn.getDomRef().getBoundingClientRect().top + 100);
	var iResizeHandlerLeft = $Resizer.position().left;
	qutils.triggerMouseEvent($Resizer, "mousedown", 1, 1, iResizeHandlerLeft, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mousemove", 1, 1, iResizeHandlerLeft + 90, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mousemove", 1, 1, iResizeHandlerLeft + 90 + 40, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mouseup", 1, 1, iResizeHandlerLeft + 90 + 40, iResizeHandlerTop, 0);

	setTimeout(function() {
		var iNewWidth = oColumn.$().width();
		assert.ok(Math.abs(iNewWidth - iWidth - 90 - 40) < 5, "check column width after resize: " + iNewWidth);
		start();
	}, 50);
});

QUnit.asyncTest("Resize via Resize Button", function(assert) {
	var oColumn = this.oColumn;
	oColumn.setResizable(true);
	sap.ui.getCore().applyChanges();

	var iWidth = oColumn.$().width();
	assert.ok(Math.abs(iWidth - 100) < 10, "check column width before resize: " + iWidth);

	var $Resizer = oTable.$("rsz");
	var iResizeHandlerTop = Math.floor(oColumn.getDomRef().getBoundingClientRect().top + 100);
	sap.ui.Device.system.desktop = false;
	sap.ui.table.TableUtils.Menu.openContextMenu(oTable, oColumn.getDomRef(), false);
	var $ResizeButton = oColumn.$().find(".sapUiTableColResizer");
	var iResizeButtonLeft = Math.floor(oColumn.getDomRef().getBoundingClientRect().left + 100);
	qutils.triggerMouseEvent($ResizeButton, "mousedown", 1, 1, iResizeButtonLeft, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mousemove", 1, 1, iResizeButtonLeft + 90, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mousemove", 1, 1, iResizeButtonLeft + 90 + 40, iResizeHandlerTop, 0);
	qutils.triggerMouseEvent($Resizer, "mouseup", 1, 1, iResizeButtonLeft + 90 + 40, iResizeHandlerTop, 0);

	setTimeout(function() {
		var iNewWidth = oColumn.$().width();
		assert.ok(Math.abs(iNewWidth - iWidth - 90 - 40) < 5, "check column width after resize: " + iNewWidth);
		start();
	}, 50);
});

QUnit.test("Skip trigger resize when resizing already started", function(assert) {
	oTable._getPointerExtension()._debug();
	var ColumnResizeHelper = oTable._getPointerExtension()._ColumnResizeHelper;
	oTable._bIsColumnResizerMoving = true;
	ok(!oTable.$().hasClass("sapUiTableResizing"), "Before Trigger");
	ColumnResizeHelper.initColumnResizing(oTable);
	ok(!oTable.$().hasClass("sapUiTableResizing"), "After Trigger");
});



QUnit.module("Mousedown", {
	setup: function() {
		createTables();
	},
	teardown: function () {
		destroyTables();
	}
});

QUnit.asyncTest("Columnheader", function(assert){
	var oColumn = oTable._getVisibleColumns()[3];
	var bColumnReorderingTriggered = false;
	var oPointerExtension = oTable._getPointerExtension();

	oPointerExtension.doReorderColumn = function() {
		bColumnReorderingTriggered = true;
	};

	qutils.triggerMouseEvent(getColumnHeader(3), "mousedown", 1, 1, 1, 1, 0);
	assert.ok(oPointerExtension._bShowMenu, "Show Menu flag set to be used in onSelect later");
	setTimeout(function(){
		assert.ok(!oPointerExtension._bShowMenu, "ShowMenu flag reset again");
		assert.ok(bColumnReorderingTriggered, "Column Reordering triggered");

		oColumn.getMenu().bOpen = true;
		oTable.setEnableColumnReordering(false);
		sap.ui.getCore().applyChanges();
		bColumnReorderingTriggered = false;

		qutils.triggerMouseEvent(getColumnHeader(3), "mousedown", 1, 1, 1, 1, 0);
		assert.ok(!oPointerExtension._bShowMenu, "Menu was opened -> _bShowMenu is false");
		setTimeout(function(){
			assert.ok(!bColumnReorderingTriggered, "Column Reordering not triggered (enableColumnReordering == false)");
			start();
		}, 250);
	}, 250);
});

QUnit.test("Scrollbar", function(assert){
	var oEvent = jQuery.Event({type : "mousedown"});
	oEvent.target = oTable.getDomRef(sap.ui.table.SharedDomRef.HorizontalScrollBar);
	oEvent.button = 0
	jQuery(oEvent.target).trigger(oEvent);
	assert.ok(oEvent.isDefaultPrevented(), "Prevent Default of mousedown on horizontal scrollbar");
	oEvent = jQuery.Event({type : "mousedown"});
	oEvent.target = oTable.getDomRef(sap.ui.table.SharedDomRef.VerticalScrollBar);
	oEvent.button = 0
	jQuery(oEvent.target).trigger(oEvent);
	assert.ok(oEvent.isDefaultPrevented(), "Prevent Default of mousedown on vertical scrollbar");
});


QUnit.module("Click", {
	setup: function() {
		createTables();
	},
	teardown: function () {
		destroyTables();
	}
});


QUnit.asyncTest("Tree Icon", function(assert) {
	var iRowCount = oTreeTable._getRowCount();
	assert.equal(oTreeTable.getBinding("rows").getLength(), iNumberOfRows, "Row count before expand");
	ok(!oTreeTable.getBinding("rows").isExpanded(0), "!Expanded");
	oTreeTable._onSelect = function() {
		assert.ok(false, "_doSelect should not be called");
	};

	var fnHandler = function() {
		sap.ui.getCore().applyChanges();
		assert.equal(oTreeTable.getBinding("rows").getLength(), iNumberOfRows + 1, "Row count after expand");
		ok(oTreeTable.getBinding("rows").isExpanded(0), "Expanded");
		QUnit.start();
	};

	oTreeTable.attachEventOnce("_rowsUpdated", fnHandler);
	var $Icon = jQuery.sap.byId(oTreeTable.getId() + "-rows-row0-col0").find(".sapUiTableTreeIcon");
	qutils.triggerMouseEvent($Icon, "click");
});


QUnit.asyncTest("Group Header", function(assert) {
	oTreeTable.setUseGroupMode(true);
	sap.ui.getCore().applyChanges();
	oTreeTable._onSelect = function() {
		assert.ok(false, "_doSelect should not be called");
	};

	var iRowCount = oTreeTable._getRowCount();
	assert.equal(oTreeTable.getBinding("rows").getLength(), iNumberOfRows, "Row count before expand");
	ok(!oTreeTable.getBinding("rows").isExpanded(0), "!Expanded");

	var fnHandler = function() {
		sap.ui.getCore().applyChanges();
		assert.equal(oTreeTable.getBinding("rows").getLength(), iNumberOfRows + 1, "Row count after expand");
		ok(oTreeTable.getBinding("rows").isExpanded(0), "Expanded");
		QUnit.start();
	};

	oTreeTable.attachEventOnce("_rowsUpdated", fnHandler);
	var $GroupHdr = jQuery.sap.byId(oTreeTable.getId() + "-rows-row0-groupHeader");
	qutils.triggerMouseEvent($GroupHdr, "click");
});


QUnit.test("Analytical Table Sum", function(assert) {
	var bSelected = false;
	oTreeTable._onSelect = function() {
		bSelected = true;
	};

	var $RowHdr = jQuery.sap.byId(oTreeTable.getId() + "-rowsel0");
	$RowHdr.addClass("sapUiAnalyticalTableSum");
	qutils.triggerMouseEvent($RowHdr, "click");
	assert.ok(!bSelected, "No Selection should happen");
});


QUnit.test("Mobile Group Menu Button", function(assert) {
	var bSelected = false;
	var bContextMenu = false;
	oTreeTable._onSelect = function() {
		bSelected = true;
	};
	oTreeTable._onContextMenu = function() {
		bContextMenu = true;
	};

	var $FakeButton = sap.ui.table.TableUtils.getRowColCell(oTreeTable, 0, 0).cell.$();
	$FakeButton.addClass("sapUiTableGroupMenuButton");
	qutils.triggerMouseEvent($FakeButton, "click");
	assert.ok(!bSelected, "No Selection should happen");
	assert.ok(bContextMenu, "Context Menu should be opened");
});


QUnit.test("Cell + Cell Click Event", function(assert) {
	var iSelectCount = 0;
	oTreeTable._onSelect = function() {
		iSelectCount++;
	};

	var fnClickHandler, bClickHandlerCalled;

	function initCellClickHandler(fnHandler) {
		if (fnClickHandler) {
			oTreeTable.detachCellClick(fnClickHandler);
			fnClickHandler = null;
		}
		bClickHandlerCalled = false;
		if (fnHandler) {
			oTreeTable.attachCellClick(fnHandler);
			fnClickHandler = fnHandler;
		}
	};

	var oRowColCell = sap.ui.table.TableUtils.getRowColCell(oTreeTable, 1, 2);
	initCellClickHandler(function(oEvent){
		bClickHandlerCalled = true;
		assert.ok(oEvent.getParameter("cellControl") === oRowColCell.cell, "Cell Click Event: Parameter cellControl");
		assert.ok(oEvent.getParameter("cellDomRef") === jQuery.sap.domById(oTreeTable.getId() + "-rows-row1-col2"), "Cell Click Event: Parameter cellDomRef");
		assert.equal(oEvent.getParameter("rowIndex"), 1, "Cell Click Event: Parameter rowIndex");
		assert.equal(oEvent.getParameter("columnIndex"), 2, "Cell Click Event: Parameter columnIndex");
		assert.equal(oEvent.getParameter("columnId"), oRowColCell.column.getId(), "Cell Click Event: Parameter columnId");
		assert.ok(oEvent.getParameter("rowBindingContext") === oRowColCell.row.getBindingContext(), "Cell Click Event: Parameter rowBindingContext");
	});
	var $Cell = oRowColCell.cell.$();
	qutils.triggerMouseEvent($Cell, "click"); // Should incease the counter
	assert.equal(iSelectCount, 1, iSelectCount + " Selections should happen");
	assert.ok(bClickHandlerCalled, "Cell Click Event handler called");

	initCellClickHandler(function(oEvent){
		oEvent.preventDefault();
		bClickHandlerCalled = true;
	});
	qutils.triggerMouseEvent($Cell, "click");
	assert.equal(iSelectCount, 1, iSelectCount + " Selections should happen");
	assert.ok(bClickHandlerCalled, "Cell Click Event handler called");

	initCellClickHandler(function(oEvent){
		bClickHandlerCalled = true;
	});
	$Cell = jQuery.sap.byId(oTreeTable.getId() + "-rows-row0-col0");
	qutils.triggerMouseEvent($Cell, "click"); // Should incease the counter
	assert.equal(iSelectCount, 2, iSelectCount + " Selections should happen");
	assert.ok(bClickHandlerCalled, "Cell Click Event handler called");

	bClickHandlerCalled = false;
	var oEvent = jQuery.Event({type : "click"});
	oEvent.setMarked();
	$Cell.trigger(oEvent);
	assert.equal(iSelectCount, 2, iSelectCount + " Selections should happen");
	assert.ok(!bClickHandlerCalled, "Cell Click Event handler not called");

	var $RowHdr = jQuery.sap.byId(oTreeTable.getId() + "-rowsel0");
	qutils.triggerMouseEvent($RowHdr, "click"); // Should incease the counter
	assert.equal(iSelectCount, 3, iSelectCount + " Selections should happen");
	assert.ok(!bClickHandlerCalled, "Cell Click Event handler not called");

	var $ColHdr = jQuery.sap.byId((oTable._getVisibleColumns()[0]).getId());
	qutils.triggerMouseEvent($ColHdr, "click");
	assert.equal(iSelectCount, 3, iSelectCount + " Selections should happen");
	assert.ok(!bClickHandlerCalled, "Cell Click Event handler not called");
});


QUnit.module("Column Reordering", {
	setup: function() {
		jQuery.sap.byId("content").toggleClass("StablePosition", true);
		createTables(true);
		oTable.placeAt("content");
		oTreeTable.placeAt("content");
		sap.ui.getCore().applyChanges();
	},
	teardown: function () {
		destroyTables();
		jQuery.sap.byId("content").toggleClass("StablePosition", false);
	}
});

function computeSettingsForReordering(oTable, iIndex, bIncreaseIndex) {
	var oSettings = {
		column : oTable._getVisibleColumns()[iIndex],
		relatedColumn : oTable._getVisibleColumns()[bIncreaseIndex ? iIndex + 1 : iIndex - 1],
	};

	var initialXPos = 2; //Move mouse 2px from left onto the column

	oSettings.top = Math.floor(oSettings.column.getDomRef().getBoundingClientRect().top);
	oSettings.left = Math.floor(oSettings.column.getDomRef().getBoundingClientRect().left) + initialXPos;
	oSettings.breakeven = (bIncreaseIndex ? oSettings.column.$().outerWidth() : 0) - initialXPos + oSettings.relatedColumn.$().outerWidth() / 2;

	return oSettings;
}

QUnit.asyncTest("Reordering via Drag&Drop - increase Index", function(assert) {
	var oSettings = computeSettingsForReordering(oTable, 2, true);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left + oSettings.breakeven;
	var iCount = 0;

	oTable.updateAnalyticalInfo = function(bFirst, bSecond) {
		ok(bFirst, "updateAnalyticalInfo with first parameter true");
		ok(bSecond, "updateAnalyticalInfo with second parameter true");
		iCount++;
	};

	assert.equal(oTable.indexOfColumn(oColumn), 2, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft - 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTable.indexOfColumn(oColumn), 2, "Index of column not changed because not dragged enough");
			assert.equal(iCount, 1, "updateAnalyticalInfo called");

			qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
			setTimeout(function(){
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft + 20, oSettings.top, 0);
				setTimeout(function() {
					sap.ui.getCore().applyChanges();
					assert.equal(oTable.indexOfColumn(oColumn), 3, "Index of column changed");
					assert.equal(iCount, 2, "updateAnalyticalInfo called");
					start();
				}, 100);
			}, 250);

		}, 100);
	}, 250);
});

QUnit.asyncTest("Reordering via Drag&Drop - decrease Index", function(assert) {
	var oSettings = computeSettingsForReordering(oTable, 2, false);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left - oSettings.breakeven;

	assert.equal(oTable.indexOfColumn(oColumn), 2, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft + 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTable.indexOfColumn(oColumn), 2, "Index of column not changed because not dragged enough");

			qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
			setTimeout(function(){
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft - 20, oSettings.top, 0);
				setTimeout(function() {
					sap.ui.getCore().applyChanges();
					assert.equal(oTable.indexOfColumn(oColumn), 1, "Index of column changed");
					start();
				}, 100);
			}, 250);

		}, 100);
	}, 250);
});

QUnit.asyncTest("No Reordering of fixed columns (within fixed)", function(assert) {
	oTable.setFixedColumnCount(4);
	sap.ui.getCore().applyChanges();

	var oSettings = computeSettingsForReordering(oTable, 2, true);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left + oSettings.breakeven;

	assert.equal(oTable.indexOfColumn(oColumn), 2, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft + 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTable.indexOfColumn(oColumn), 2, "Index of column not changed");
			start();
		}, 100);
	}, 250);
});

QUnit.asyncTest("No Reordering of fixed columns (fixed to not fixed)", function(assert) {
	oTable.setFixedColumnCount(3);
	sap.ui.getCore().applyChanges();

	var oSettings = computeSettingsForReordering(oTable, 2, true);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left + oSettings.breakeven;

	assert.equal(oTable.indexOfColumn(oColumn), 2, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft + 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTable.indexOfColumn(oColumn), 2, "Index of column not changed");
			start();
		}, 100);
	}, 250);
});

QUnit.asyncTest("No Reordering of fixed columns (not fixed to fixed)", function(assert) {
	oTable.setFixedColumnCount(2);
	sap.ui.getCore().applyChanges();

	var oSettings = computeSettingsForReordering(oTable, 2, false);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left - oSettings.breakeven;

	assert.equal(oTable.indexOfColumn(oColumn), 2, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft - 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTable.indexOfColumn(oColumn), 2, "Index of column not changed");
			start();
		}, 100);
	}, 250);
});

QUnit.asyncTest("TreeTable - No Reordering via Drag&Drop of first column - increase index", function(assert) {
	oTreeTable.setFixedColumnCount(0);
	sap.ui.getCore().applyChanges();

	var oSettings = computeSettingsForReordering(oTreeTable, 0, true);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left + oSettings.breakeven;

	assert.equal(oTreeTable.indexOfColumn(oColumn), 0, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft - 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTreeTable.indexOfColumn(oColumn), 0, "Index of column not changed because not dragged enough");

			qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
			setTimeout(function(){
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 30, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 20, oSettings.top, 0);
				qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft + 20, oSettings.top, 0);
				setTimeout(function() {
					sap.ui.getCore().applyChanges();
					assert.equal(oTreeTable.indexOfColumn(oColumn), 0, "Index of column not changed");
					start();
				}, 100);
			}, 250);

		}, 100);
	}, 250);
});

QUnit.asyncTest("TreeTable - No Reordering via Drag&Drop of first column - decrease index", function(assert) {
	oTreeTable.setFixedColumnCount(0);
	sap.ui.getCore().applyChanges();

	var oSettings = computeSettingsForReordering(oTreeTable, 1, false);
	var oColumn = oSettings.column;
	var iLeft = oSettings.left - oSettings.breakeven;

	assert.equal(oTreeTable.indexOfColumn(oColumn), 1, "Initial index of column");

	qutils.triggerMouseEvent(oColumn.$(), "mousedown", 1, 1, oSettings.left, oSettings.top, 0);
	setTimeout(function(){
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft + 30, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mousemove", 1, 1, iLeft - 20, oSettings.top, 0);
		qutils.triggerMouseEvent(oColumn.$(), "mouseup", 1, 1, iLeft - 20, oSettings.top, 0);
		setTimeout(function() {
			sap.ui.getCore().applyChanges();
			assert.equal(oTreeTable.indexOfColumn(oColumn), 1, "Index of column not changed");
			start();
		}, 100);
	}, 250);
});



QUnit.module("Row Hover Effect", {
	setup: function() {
		jQuery.sap.byId("content").toggleClass("StablePosition", true);
		createTables(true);
		oTable.placeAt("content");
		oTreeTable.placeAt("content");
		sap.ui.getCore().applyChanges();
	},
	teardown: function () {
		destroyTables();
		jQuery.sap.byId("content").toggleClass("StablePosition", false);
	}
});

QUnit.test("RowHeader", function(assert) {
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
	getRowHeader(0).mouseover();
	assert.ok(getRowHeader(0).hasClass("sapUiTableRowHvr"), "Hover effect on row header");
	assert.ok(getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "Hover effect on fixed part of row");
	assert.ok(getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "Hover effect on scroll part of row");
	getRowHeader(0).mouseout();
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
});

QUnit.test("Fixed column area", function(assert) {
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
	getCell(0, 0).mouseover();
	assert.ok(getRowHeader(0).hasClass("sapUiTableRowHvr"), "Hover effect on row header");
	assert.ok(getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "Hover effect on fixed part of row");
	assert.ok(getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "Hover effect on scroll part of row");
	getCell(0, 0).mouseout();
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
});

QUnit.test("Scroll column area", function(assert) {
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
	getCell(0, 2).mouseover();
	assert.ok(getRowHeader(0).hasClass("sapUiTableRowHvr"), "Hover effect on row header");
	assert.ok(getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "Hover effect on fixed part of row");
	assert.ok(getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "Hover effect on scroll part of row");
	getCell(0, 2).mouseout();
	assert.ok(!getRowHeader(0).hasClass("sapUiTableRowHvr"), "No hover effect on row header");
	assert.ok(!getCell(0, 0).parent().hasClass("sapUiTableRowHvr"), "No hover effect on fixed part of row");
	assert.ok(!getCell(0, 2).parent().hasClass("sapUiTableRowHvr"), "No hover effect on scroll part of row");
});



QUnit.module("Helpers", {
	setup: function() {
		createTables();
	},
	teardown: function () {
		destroyTables();
	}
});

QUnit.test("_debug()", function(assert) {
	var oExtension = oTable._getPointerExtension();
	assert.ok(!oExtension._ExtensionHelper, "No debug mode");
	oExtension._debug();
	assert.ok(!!oExtension._ExtensionHelper, "Debug mode");
});

QUnit.test("_getEventPosition()", function(assert) {
	oTable._getPointerExtension()._debug();
	var oExtensionHelper = oTable._getPointerExtension()._ExtensionHelper;

	var oEvent,
		oPos,
		x = 15,
		y = 20,
		oCoord = {pageX: x, pageY: y};

	oEvent = jQuery.extend({originalEvent: {}}, oCoord);

	oPos = oExtensionHelper._getEventPosition(oEvent, oTable);
	assert.equal(oPos.x, x, "MouseEvent - X");
	assert.equal(oPos.y, y, "MouseEvent - Y");

	oEvent = {
		targetTouches: [oCoord],
		originalEvent: {
			touches: []
		}
	};

	oPos = oExtensionHelper._getEventPosition(oEvent, oTable);
	assert.equal(oPos.x, x, "TouchEvent - X");
	assert.equal(oPos.y, y, "TouchEvent - Y");

	oEvent = {
		touches: [oCoord],
		originalEvent: {
			touches: [],
			targetTouches: [oCoord]
		}
	};

	oPos = oExtensionHelper._getEventPosition(oEvent, oTable);
	assert.equal(oPos.x, x, "TouchEvent (wrapped) - X");
	assert.equal(oPos.y, y, "TouchEvent (wrapped) - Y");
});



QUnit.module("Destruction", {
	setup: function() {
		createTables();
	},
	teardown: function () {
		oTable = null;
		oTreeTable.destroy();
		oTreeTable = null;
	}
});


QUnit.test("destroy()", function(assert) {
	var oExtension = oTable._getPointerExtension();
	oTable.destroy();
	assert.ok(!oExtension.getTable(), "Table cleared");
	assert.ok(!oExtension._delegate, "Delegate cleared");
});