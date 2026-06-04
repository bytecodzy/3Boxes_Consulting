;(function($){

$(document).ready(function(){

//========== HEADER ACTIVE STRATS ============= //
  var $header = $("#vl-header-sticky");
  var $window = $(window);
  function toggleStickyHeader() {
    var scrollTop = $window.scrollTop();
    if (scrollTop < 100) {
      $header.removeClass("header-sticky");
    } else {
      $header.addClass("header-sticky");
    }
  }
  $window.on("scroll", toggleStickyHeader);
  toggleStickyHeader();
//========== HEADER ACTIVE ENDS ============= //

//========== MOBILE MENU STARTS ============= //
  var vlMenuWrap = $('.vl-mobile-menu-active > ul').clone();
  var vlSideMenu = $('.vl-offcanvas-menu nav');
  vlSideMenu.append(vlMenuWrap);
  
  if ($(vlSideMenu).find('.sub-menu, .vl-mega-menu').length !== 0) {
    $(vlSideMenu).find('.sub-menu, .vl-mega-menu').parent().append('<button class="vl-menu-close"><i class="fas fa-chevron-right"></i></button>');
  }

  // Chevron button toggles the sub-menu
  var sideMenuToggle = $('.vl-offcanvas-menu nav > ul > li button.vl-menu-close, .vl-offcanvas-menu nav > ul li.has-dropdown button.vl-menu-close');
  $(sideMenuToggle).on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var $parent = $(this).parent();

    if (!$parent.hasClass('active')) {
      $parent.addClass('active');
      $(this).siblings('.sub-menu, .vl-mega-menu').slideDown();
    } else {
      $(this).siblings('.sub-menu, .vl-mega-menu').slideUp();
      $parent.removeClass('active');
    }
  });

  // Main menu link navigates to the page (no preventDefault)
  var sideMenuLinks = $('.vl-offcanvas-menu nav > ul li.has-dropdown > a');
  $(sideMenuLinks).on('click', function (e) {
    // Allow default navigation — the <a href> works normally
    // Close the offcanvas menu after navigation
    setTimeout(function() {
      $(".vl-offcanvas").removeClass("vl-offcanvas-open");
      $(".vl-offcanvas-overlay").removeClass("vl-offcanvas-overlay-open");
    }, 150);
  });

  $(".vl-offcanvas-toggle").on('click', function() {
    $(".vl-offcanvas").addClass("vl-offcanvas-open");
    $(".vl-offcanvas-overlay").addClass("vl-offcanvas-overlay-open");
  });

  $(".vl-offcanvas-close-toggle, .vl-offcanvas-overlay").on('click', function() {
    $(".vl-offcanvas").removeClass("vl-offcanvas-open");
    $(".vl-offcanvas-overlay").removeClass("vl-offcanvas-overlay-open");
  });
//========== MOBILE MENU ENDS ============= //

//========== PAGE PROGRESS STARTS ============= //
//========== PAGE PROGRESS STARTS ============= //
//========== AI ASK BUTTON ============= //
setTimeout(function () {
  $("#ai-ask-btn").addClass("ai-ask-visible");
  $("#ai-chat-popup").addClass("ai-chat-open");
}, 1800);

 $("#ai-ask-btn").on("click", function(event) {
  event.preventDefault();
  $("#ai-chat-popup").toggleClass("ai-chat-open");
  return false;
});

 $("#ai-chat-close").on("click", function(event) {
  event.preventDefault();
  $("#ai-chat-popup").removeClass("ai-chat-open");
  return false;
});
//========== AI ASK BUTTON ENDS ============= //

// ===== AI CHAT FUNCTIONALITY (Botpress Integration) =====
(function() {

  var chatBody  = document.getElementById("ai-chat-body");
  var userInput = document.getElementById("ai-user-input");
  var sendBtn   = document.getElementById("ai-send-btn");
  var voiceBtn  = document.getElementById("ai-voice-btn");
  var chips     = document.getElementById("ai-quick-chips");

  if (!chatBody || !userInput || !sendBtn) return;

  // ──── BOTPRESS SESSION STATE (all stored in localStorage — stateless backend) ────
  var chatUserId = localStorage.getItem('3boxes_chat_userId') || null;
  var chatConversationId = localStorage.getItem('3boxes_chat_conversationId') || null;
  var chatUserKey = localStorage.getItem('3boxes_chat_userKey') || null;
  var chatBotpressUserId = localStorage.getItem('3boxes_chat_botpressUserId') || null;
  var isWaitingForReply = false;

  // Initialize session on page load
  initSession();

  // ------- INITIALIZE SESSION -------
  function initSession() {
    if (!chatUserId) {
      // Generate a unique user ID and store it
      chatUserId = 'webuser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('3boxes_chat_userId', chatUserId);
    }
    console.log('[3Boxes Chat] Session initialized. UserId:', chatUserId, 'ConvId:', chatConversationId, 'HasKey:', !!chatUserKey);
  }

  // ------- APPEND MESSAGE -------
  function appendMessage(sender, text) {
    var wrapper = document.createElement("div");
    wrapper.className = "ai-chat-message " + (sender === "user" ? "ai-user-msg" : "ai-bot-msg");

    var bubble = document.createElement("div");
    bubble.className = "ai-msg-bubble";
    bubble.innerHTML = text;

    wrapper.appendChild(bubble);

    // Insert before chips if chips exist, otherwise just append
    if (chips && chips.parentNode === chatBody) {
      chatBody.insertBefore(wrapper, chips);
    } else {
      chatBody.appendChild(wrapper);
    }

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ------- SHOW TYPING -------
  function showTyping() {
    var wrapper = document.createElement("div");
    wrapper.className = "ai-chat-message ai-bot-msg";
    wrapper.id = "ai-typing";

    var dots = document.createElement("div");
    dots.className = "ai-typing-indicator";
    dots.innerHTML = "<span></span><span></span><span></span>";

    wrapper.appendChild(dots);

    if (chips && chips.parentNode === chatBody) {
      chatBody.insertBefore(wrapper, chips);
    } else {
      chatBody.appendChild(wrapper);
    }

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ------- REMOVE TYPING -------
  function removeTyping() {
    var el = document.getElementById("ai-typing");
    if (el) el.remove();
  }

  // ------- SEND MESSAGE -------
  function sendMessage() {
    var text = userInput.value.trim();
    if (!text || isWaitingForReply) return;

    // Hide chips on first message
    if (chips) chips.classList.add("ai-chips-hidden");

    appendMessage("user", text);
    userInput.value = "";

    showTyping();
    isWaitingForReply = true;
    sendBtn.disabled = true;

    getBotpressResponse(text);
  }

  // ------- CALL BOTPRESS API VIA BACKEND -------
  function getBotpressResponse(userText, isRetry) {
    var apiUrl = window.location.origin + '/api/chat/message';

    var requestBody = {
      userId: chatUserId,
      message: userText
    };

    // Include conversation ID if we have one (continues the conversation)
    // On retry, DON'T send the old conversationId so a fresh one is created
    if (chatConversationId && !isRetry) {
      requestBody.conversationId = chatConversationId;
    }

    // Send userKey and botpressUserId so the backend is stateless
    // (These are returned by the backend after user creation and stored in localStorage)
    if (chatUserKey) {
      requestBody.userKey = chatUserKey;
    }
    if (chatBotpressUserId) {
      requestBody.botpressUserId = chatBotpressUserId;
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
    .then(function(response) {
      return response.json().then(function(data) {
        return { status: response.status, data: data };
      });
    })
    .then(function(result) {
      var data = result.data;
      removeTyping();
      isWaitingForReply = false;
      sendBtn.disabled = false;

      if (data.success && data.reply) {
        // Save ALL session data for future messages (stateless backend)
        chatConversationId = data.conversationId;
        localStorage.setItem('3boxes_chat_conversationId', chatConversationId);

        if (data.userKey) {
          chatUserKey = data.userKey;
          localStorage.setItem('3boxes_chat_userKey', chatUserKey);
        }
        if (data.botpressUserId) {
          chatBotpressUserId = data.botpressUserId;
          localStorage.setItem('3boxes_chat_botpressUserId', chatBotpressUserId);
        }

        // Display bot response (convert markdown-style bold to HTML)
        var formattedReply = data.reply
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br>');

        appendMessage("bot", formattedReply);
      } else if (data.shouldReset && !isRetry) {
        // Bot failed to respond — clear stale conversation and retry once
        console.log('[3Boxes Chat] Bot timeout, resetting conversation and retrying...');
        chatConversationId = null;
        localStorage.removeItem('3boxes_chat_conversationId');
        // Keep userKey and botpressUserId — they're still valid
        isWaitingForReply = true;
        sendBtn.disabled = true;
        showTyping();
        getBotpressResponse(userText, true);
      } else {
        appendMessage("bot", "I'm having trouble responding right now. Please try again or contact us at info@3boxesconsulting.com");
      }
    })
    .catch(function(error) {
      console.error('[3Boxes Chat] Error:', error);
      removeTyping();
      isWaitingForReply = false;
      sendBtn.disabled = false;
      appendMessage("bot", "Sorry, I'm having trouble connecting. Please try again in a moment.");
    });
  }

  // ------- SEND ON BUTTON CLICK -------
  sendBtn.addEventListener("click", function(e) {
    e.preventDefault();
    sendMessage();
  });

  // ------- SEND ON ENTER KEY -------
  userInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  userInput.addEventListener("input", function() {
    if (userInput.value.trim()) {
      if (chips) chips.classList.add("ai-chips-hidden");
    } else {
      if (chips) chips.classList.remove("ai-chips-hidden");
    }
  });

  // ------- QUICK CHIPS CLICK -------
  document.querySelectorAll(".ai-quick-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var query = this.getAttribute("data-query");
      userInput.value = query;
      sendMessage();
    });
  });

  // ------- VOICE INPUT -------
  var isListening = false;

  if (voiceBtn) {
    voiceBtn.addEventListener("click", function() {
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Voice input is not supported in this browser.");
        return;
      }
      if (isListening) return;

      var recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;

      recognition.start();
      isListening = true;
      voiceBtn.classList.add("listening");

      recognition.onresult = function(event) {
        var transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        isListening = false;
        voiceBtn.classList.remove("listening");
        sendMessage();
      };

      recognition.onerror = function() {
        isListening = false;
        voiceBtn.classList.remove("listening");
      };

      recognition.onend = function() {
        isListening = false;
        voiceBtn.classList.remove("listening");
      };
    });
  }

})();
// ===== AI CHAT FUNCTIONALITY ENDS =====

//========== PAGE PROGRESS STARTS ============= // 

//========== PRICING AREA ============= //
$("#ce-toggle").change(function () {
  const isChecked = $(this).is(":checked");
  $(".plan-toggle-wrap").toggleClass("active", isChecked);
  $(".tab-content #yearly").toggle(!isChecked);
  $(".tab-content #monthly").toggle(isChecked);
});
//========== PRICING AREA ============= //

//========== VIDEO POPUP STARTS ============= //
if ($(".popup-youtube").length > 0) {
  $(".popup-youtube").magnificPopup({
    type: "iframe",
  });
}
//========== VIDEO POPUP ENDS ============= //
AOS.init;
AOS.init({disable: 'mobile'});

//========== NICE SELECT ============= //
 $('select:not(.career-select)').niceSelect();

});
//========== COUNTER UP============= //
const ucounter = $('.counter');
if (ucounter.length > 0) {
  ucounter.countUp();
};

//========== TESTIMONIAL AREA ============= //
// SLIDER //
$(".case-slider-area").slick({
  slidesToShow: 3,
  slidesToScroll: 1,
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  prevArrow: $(".next-arrow"),
  nextArrow: $(".prev-arrow"), 
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});


// SLIDER //
$(".testimonial-slider").slick({
  slidesToShow: 1,
  slidesToScroll: 1,
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  prevArrow: $(".next-arrow1"),
  nextArrow: $(".prev-arrow1"), 
});


// SLIDER //
$(".hero-main-slider").slick({
  autoplay:true,
  autoplaySpeed:1500,
  speed:2000,
  slidesToShow:1,
  slidesToScroll:1,
  pauseOnHover:false,
  dots:false,
  arrows:true,
  pauseOnDotsHover:true,
  cssEase:'linear',
  fade:true,
  draggable:true,
  prevArrow: $(".next-arrow-hero"),
  nextArrow: $(".prev-arrow-hero"), 
}); 


// SLIDER //
$(".testimonial-bottom-slider").slick({
  slidesToShow: 3,
  slidesToScroll: 1,
  dots: false,
  arrows: false,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 3,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});


// SLIDER //
$(".team-slider-boxarea").slick({
  slidesToShow: 3,
  slidesToScroll: 1,
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  prevArrow: $(".t-prev-area"),
  nextArrow: $(".t-next-area"), 
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 4,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});

// SLIDER //
$(".cas3-widget-slider-area").slick({
  slidesToShow: 3,
  slidesToScroll: 1,
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  prevArrow: $(".next-arrow-case3"),
  nextArrow: $(".prev-arrow-case3"), 
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});


// SLIDER //
$(".brand-images-slider").slick({
  slidesToShow: 5,
  slidesToScroll: 1,
  dots: false,
  arrows: false,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 5,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 3,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    }
  ]
});

// SLIDER //
$(".testimonial4-images").slick({
  slidesToShow: 1,
  slidesToScroll: 1,
  arrows: false,
  autoplay:true,
  autoplaySpeed:2000,
  loop: true,
  focusOnSelect: true,
  vertical:false,
  asNavFor: ".testimonial4-contetnt-area",
  infinite: true,
  fade:true,
});

$(".testimonial4-contetnt-area").slick({
  slidesToShow: 1,
  slidesToScroll: 1,
  asNavFor: ".testimonial4-images",
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  prevArrow: $(".prev-arrow-testi4"),
  nextArrow: $(".next-arrow-testi4"), 
});

// SLIDER //
$(".service-widget-slider-area").slick({
  slidesToShow: 3,
  slidesToScroll: 1,
  dots: false,
  arrows: true,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
  prevArrow: $(".next-arrow-ser4"),
  nextArrow: $(".prev-arrow-ser4"), 
  responsive: [
    {
      breakpoint: 1024,
      settings: {
        slidesToShow: 4,
        slidesToScroll: 1,
        infinite: true,
      }
    },
    {
      breakpoint: 769,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        slidesToScroll: 1
      }
    }
  ]
});

$(".testimonial7-contetnt-area").slick({
  slidesToShow: 1,
  slidesToScroll: 1,
  arrows: false,
  autoplay:true,
  autoplaySpeed:2000,
  loop: true,
  focusOnSelect: true,
  vertical:false,
  infinite: true,
  fade:false,
  dots: true,
});

// SLIDER //
$(".testimonial8-slider").slick({
  slidesToShow: 1,
  slidesToScroll: 1,
  asNavFor: ".brand-images-area",
  dots: false,
  arrows: false,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  autoplay:true,
  autoplaySpeed:2000,
  infinite: true,
});

$(".brand-images-area").slick({
  slidesToShow: 4,
  slidesToScroll: 1,
  asNavFor: ".testimonial8-slider",
  dots: false,
  arrows: false,
  centerMode: false,
  focusOnSelect: true,
  loop: true,
  responsive: [
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 2,
        slidesToScroll: 1
      }
    }
  ]
});


//========== PRELOADER ============= //
$(window).on("load", function (event) {
  setTimeout(function () {
    $(".preloader").fadeToggle();
  }, 900);
});
})(jQuery);

// ===== CAREERS PAGE INTERACTIVITY =====

document.addEventListener("DOMContentLoaded", function () {

  // ------- 5A: BOOKMARK TOGGLE -------
  document.querySelectorAll(".job-bookmark-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      this.classList.toggle("active");
      const icon = this.querySelector("i");
      if (this.classList.contains("active")) {
        icon.classList.remove("fa-regular");
        icon.classList.add("fa-solid");
      } else {
        icon.classList.remove("fa-solid");
        icon.classList.add("fa-regular");
      }
    });
  });

  // ------- 5B: SHARE DROPDOWN TOGGLE -------
  document.querySelectorAll(".job-share-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const card = this.closest(".job-card");
      const dropdown = card.querySelector(".job-share-dropdown");

      // Close all other dropdowns first
      document.querySelectorAll(".job-share-dropdown.active").forEach(function (d) {
        if (d !== dropdown) d.classList.remove("active");
      });

      dropdown.classList.toggle("active");
      this.classList.toggle("active");
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function () {
    document.querySelectorAll(".job-share-dropdown.active").forEach(function (d) {
      d.classList.remove("active");
    });
    document.querySelectorAll(".job-share-btn.active").forEach(function (b) {
      b.classList.remove("active");
    });
  });

  // ------- 5C: SEARCH / FILTER (Basic) -------
  const searchBtn = document.getElementById("job-search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      const keyword = document.getElementById("job-keyword").value.toLowerCase();
      const location = document.getElementById("job-location").value.toLowerCase();
      const experience = document.getElementById("job-experience").value.toLowerCase();

      document.querySelectorAll(".job-card").forEach(function (card) {
        const title = card.querySelector(".job-title").textContent.toLowerCase();
        const desc = card.querySelector(".job-description").textContent.toLowerCase();
        const meta = card.querySelector(".job-meta").textContent.toLowerCase();

        let show = true;
        if (keyword && !title.includes(keyword) && !desc.includes(keyword)) show = false;
        if (location && !meta.includes(location)) show = false;
        // Experience filter would need data attributes on cards (Step 6)

        card.closest(".col-lg-6").style.display = show ? "" : "none";
      });
    });
  }

});

