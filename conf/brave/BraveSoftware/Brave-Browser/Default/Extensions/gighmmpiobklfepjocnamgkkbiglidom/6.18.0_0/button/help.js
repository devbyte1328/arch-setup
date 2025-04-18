/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* For ESLint: List any global identifiers used in this file below */
/* global selectedOff, selected, pageInfo, popupMenuHelpActionMap, browser,
  localizePage, DOMPurify, ellipsis */

let cleanButtonHTML;
let cleanSegueHTML;
let cleanSectionHTML;
let segueBreadCrumb = [];
let popupMenuHelpMap = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let filterUpdateError = false;
let logSent = false;
let closeKeydownHandler;
let backKeydownHandler;
let primarysectionDisplay;
let ytChannelSectionDisplay;
let twitchChannelSectionDisplay;
let disabledSiteSectionDisplay;
let pauseSubsectionDisplay;
let domainPausedSubsectionDisplay;
let allPausedSubsectionDisplay;
let allowlistedSubsectionDisplay;

const logHelpFlowResults = function (source) {
  logSent = true;
  browser.runtime.sendMessage({
    command: "recordGeneralMessage",
    msg: "help_flow_results",
    additionalParams: { hfd: `${segueBreadCrumb},${source}` },
  });
};

$(window).on("unload", () => {
  if (!logSent && segueBreadCrumb.length > 0) {
    logHelpFlowResults("popupClosed");
  }
});

let savedData = {};

const reset = function () {
  segueBreadCrumb = [];
  $("#help_content").empty();
  $("#primary_section").css("display", primarysectionDisplay);
  $("#yt_channel_section").css("display", ytChannelSectionDisplay);
  $("#twitch_channel_section").css("display", twitchChannelSectionDisplay);
  $("#disabled_site_section").css("display", disabledSiteSectionDisplay);
  $("#pause_subsection").css("display", pauseSubsectionDisplay);
  $("#domain_paused_subsection").css("display", domainPausedSubsectionDisplay);
  $("#all_paused_subsection").css("display", allPausedSubsectionDisplay);
  $("#allowlisted_subsection").css("display", allowlistedSubsectionDisplay);

  $("#help_overlay").hide();
  // eslint-disable-next-line no-use-before-define
  selectedOff("#close_icon", closeClickHandler, closeKeydownHandler);
  // eslint-disable-next-line no-use-before-define
  selectedOff("#back_icon", backClickHandler, backKeydownHandler);
  filterUpdateError = false;
  savedData = {};
};

// Show the next help page.
// Inputs: segueToId:string - the property in the help-map object to show next
//         backIconClicked:boolean (optional) - if true, indicates that the back button was clicked
//                                              and we shouldn't save the 'segueToId' paramter in
//                                              the segueBreadCrumb array
//
const transitionTo = function (segueToId, backIconClicked) {
  const nextHelpPage = popupMenuHelpMap[segueToId];
  if (!nextHelpPage) {
    return;
  }
  const $content = $("#help_content");
  $content.empty();
  if (!backIconClicked) {
    segueBreadCrumb.push(segueToId);
  }
  if (nextHelpPage.title) {
    if (nextHelpPage.title.useSavedData && savedData.titleText) {
      $("#help_title").attr("i18n", savedData.titleText);
    } else {
      $("#help_title").attr("i18n", nextHelpPage.title);
    }
  }
  const $textContainer = $('<div id="text_container">');
  $content.append($textContainer);
  // process any segues - will be displayed first
  if (Array.isArray(nextHelpPage.segues)) {
    for (const segue of nextHelpPage.segues) {
      if (!segue.showIfPremiumUser || pageInfo.activeLicense) {
        const $cleanCloneSegueHTML = $(cleanSegueHTML);
        $cleanCloneSegueHTML.find(".segue-text").attr("i18n", segue.content);
        selected($cleanCloneSegueHTML.find(".segue-box"), () => {
          if (segue.segueToIfPaused && (pageInfo.paused || pageInfo.domainPaused)) {
            transitionTo(segue.segueToIfPaused);
            return;
          }
          if (segue.segueToIfWhitelisted && pageInfo.whitelisted) {
            transitionTo(segue.segueToIfWhitelisted);
            return;
          }
          if (segue.action && popupMenuHelpActionMap[segue.action]) {
            popupMenuHelpActionMap[segue.action](segue);
          }
          transitionTo(segue.segueTo);
        });
        $textContainer.append($cleanCloneSegueHTML);
      }
    }
  }
  // sections
  if (Array.isArray(nextHelpPage.sections)) {
    for (const section of nextHelpPage.sections) {
      const $cleanCloneSectionHTML = $(cleanSectionHTML);
      $textContainer.append($cleanCloneSectionHTML);
      for (const content of section.content) {
        const textSpan = $('<span tabindex="0" class="section-text"></span>');
        $cleanCloneSectionHTML.find(".section-box").append(textSpan);
        if (content.linkURL) {
          const linkAnchor = $('<a href="#" tabindex="0">');
          // create a random String to use an id for the i18n processing
          const randLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          const randNumber = Date.now() + Math.floor(Math.random() * 1000000);
          const i18nReplacementElId = randLetter + randNumber;
          linkAnchor.attr("id", i18nReplacementElId);
          selected(linkAnchor, () => {
            let urlToOpen = content.linkURL;
            if (!/^(https|mailto):/.test(urlToOpen)) {
              urlToOpen = browser.runtime.getURL(urlToOpen);
            }
            browser.runtime.sendMessage({ command: "openTab", urlToOpen });
            logHelpFlowResults("link");
            reset();
          });
          textSpan.attr("i18n_replacement_el", i18nReplacementElId);
          textSpan.append(document.createTextNode(" "));
          textSpan.append(linkAnchor);
          textSpan.append(document.createTextNode(" "));
        }
        if (content.displayURL) {
          let displayURL = "";
          if (typeof pageInfo.url === "object") {
            displayURL = ellipsis(pageInfo.url.origin + pageInfo.url.pathname, 90);
          } else if (typeof pageInfo.url === "string") {
            displayURL = ellipsis(pageInfo.url, 90);
          }
          textSpan.text(displayURL);
          textSpan.addClass("url-info");
        }
        if (content.text) {
          textSpan.attr("i18n", content.text);
        }
        textSpan.after("&nbsp;");
      }
    }
  }
  // buttons
  let multipleButton = false;
  if (Array.isArray(nextHelpPage.buttons)) {
    const $buttonContainer = $('<div class="button-container">');
    if (nextHelpPage.buttons.length > 1) {
      multipleButton = true;
    }
    for (const button of nextHelpPage.buttons) {
      const $cleanCloneButtonHTML = $(cleanButtonHTML);
      if (button.text) {
        $cleanCloneButtonHTML.find(".button-text").attr("i18n", button.text);
      }
      if (button.icon) {
        $cleanCloneButtonHTML.find(".button-icon").text(button.icon);
      } else {
        $cleanCloneButtonHTML.find(".button-icon").hide();
      }
      if (button.rotateIcon) {
        $cleanCloneButtonHTML.find(".button-icon").addClass("spin-counter-clockwise");
      }
      if (button.disabled) {
        $cleanCloneButtonHTML.attr("disabled", true);
      }
      if (button.action) {
        selected($cleanCloneButtonHTML, () => {
          if ($cleanCloneButtonHTML.prop("disabled")) {
            return;
          }
          if (popupMenuHelpActionMap[button.action]) {
            popupMenuHelpActionMap[button.action]();
          }
        });
      }
      if (multipleButton) {
        $cleanCloneButtonHTML.addClass("multiple-button");
      }
      $cleanCloneButtonHTML.addClass("help-button");
      if (button.secondaryButton) {
        $cleanCloneButtonHTML.addClass("secondary");
        $cleanCloneButtonHTML.removeClass("help-button");
      }
      $buttonContainer.append($cleanCloneButtonHTML);
    }
    $content.append($buttonContainer);
  }

  if (nextHelpPage.footer) {
    $("#help_footer").parent().show();
    $("#help_footer").attr("i18n", nextHelpPage.footer);
  } else {
    $("#help_footer").parent().hide();
  }
  if (nextHelpPage.dc_help_footer) {
    selected($("#dc_help_footer"), () => {
      if (popupMenuHelpActionMap[nextHelpPage.dc_help_footer]) {
        popupMenuHelpActionMap[nextHelpPage.dc_help_footer]();
      }
    });
    $("#dc_help_footer").parent().show();
  } else {
    $("#dc_help_footer").parent().hide();
  }
  localizePage();
  // if there's multiple buttons, make sure each of them are the same max height
  if ($content.find(".multiple-button").length) {
    const $buttons = $("#help_content .multiple-button");
    $buttons.each(function outerFN() {
      let maxHeight = 0;
      $content.find(".multiple-button", this).each(function innerFN() {
        if ($(this).height() > maxHeight) {
          maxHeight = $(this).height();
        }
      });
      $content.find(".multiple-button", this).css("height", maxHeight);
    });
  }

  if (backIconClicked) {
    $content.addClass("previousPage");
    $content.one("animationend", () => {
      $content.removeClass("previousPage");
    });
  } else {
    $content.addClass("nextPage");
    $content.one("animationend", () => {
      $content.removeClass("nextPage");
    });
  }
};

const closeClickHandler = function () {
  logHelpFlowResults("closeIcon");
  reset();
};

const backClickHandler = function () {
  if (segueBreadCrumb.length > 1) {
    segueBreadCrumb.pop(); // remove current page
    const lastSegueId = segueBreadCrumb[segueBreadCrumb.length - 1]; // now get the previous page
    transitionTo(lastSegueId, true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    filterUpdateError = false;
  } else {
    logHelpFlowResults("backIcon");
    reset();
  }
};

const loadHTMLSegments = function () {
  const helpSegueRequest = fetch("./button/help-segue.html").then((response) => response.text());
  const helpOkayRequest = fetch("./button/help-button.html").then((response) => response.text());
  const helpSectionRequest = fetch("./button/help-section.html").then((response) =>
    response.text(),
  );
  const helpMapRequest = fetch("./button/help-map.json").then((response) => response.json());
  return Promise.all([helpSegueRequest, helpOkayRequest, helpSectionRequest, helpMapRequest]).then(
    (values) => {
      cleanSegueHTML = DOMPurify.sanitize(values[0], { SAFE_FOR_JQUERY: true });
      cleanButtonHTML = DOMPurify.sanitize(values[1], { SAFE_FOR_JQUERY: true });
      cleanSectionHTML = DOMPurify.sanitize(values[2], { SAFE_FOR_JQUERY: true });
      [, , , popupMenuHelpMap] = values;
    },
  );
};

const postLoadInitialize = function () {
  reset();
  const startConfig = popupMenuHelpMap.start;
  if (startConfig.footer) {
    $("#help_footer").attr("i18n", startConfig.footer);
  } else {
    $("#help_footer").hide();
  }
  closeKeydownHandler = selected("#close_icon", closeClickHandler);
  backKeydownHandler = selected("#back_icon", backClickHandler);
  transitionTo("start");
  primarysectionDisplay = $("#primary_section").css("display");
  ytChannelSectionDisplay = $("#yt_channel_section").css("display");
  twitchChannelSectionDisplay = $("#twitch_channel_section").css("display");
  disabledSiteSectionDisplay = $("#disabled_site_section").css("display");
  pauseSubsectionDisplay = $("#pause_subsection").css("display");
  domainPausedSubsectionDisplay = $("#domain_paused_subsection").css("display");
  allPausedSubsectionDisplay = $("#all_paused_subsection").css("display");
  allowlistedSubsectionDisplay = $("#allowlisted_subsection").css("display");

  $("#primary_section").hide();
  $("#yt_channel_section").hide();
  $("#twitch_channel_section").hide();
  $("#disabled_site_section").hide();
  $("#pause_subsection").hide();
  $("#domain_paused_subsection").hide();
  $("#all_paused_subsection").hide();
  $("#allowlisted_subsection").hide();
  $("#help_overlay").css({ display: "flex" });
  $("#separator_help").show();
};

/* eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars */
const showHelpSetupPage = function () {
  loadHTMLSegments().then(() => {
    postLoadInitialize();
  });
};
