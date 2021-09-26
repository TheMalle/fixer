(require 'package)
 
;; Add package archive URL
(setq package-archives
      '(("melpa" . "https://melpa.org/packages/")
	("gnu" . "https://elpa.gnu.org/packages/")))

;; Added by Package.el.  This must come before configurations of
;; installed packages.  Don't delete this line.  If you don't want it,
;; just comment it out by adding a semicolon to the start of the line.
;; You may delete these explanatory comments.
(package-initialize)

;; Fetch package list
(unless package-archive-contents
  (package-refresh-contents))

(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(ansi-color-names-vector
   ["#000000" "#8b0000" "#00ff00" "#ffa500" "#7b68ee" "#dc8cc3" "#93e0e3" "#dcdccc"])
 '(column-number-mode t)
 '(fci-rule-color "#383838")
 '(package-selected-packages
   (quote
    (rg json-mode csharp-mode rainbow-delimiters clojure-mode cyberpunk-theme yaml-mode nix-mode magit elixir-mode)))
 '(show-paren-mode t))

;; Ensure selected packages are installed
(package-install-selected-packages)

;; Load theme
;; (load-theme 'cyberpunk t)

;; Custom set some visual elements
;(custom-set-faces
; ;; custom-set-faces was added by Custom.
; ;; If you edit it by hand, you could mess it up, so be careful.
; ;; Your init file should contain only one such instance.
; ;; If there is more than one, they won't work right.
; ;; '(default ((t (:inherit nil :stipple nil :background "color-16" :foreground "color-47" :inverse-video nil :box nil :strike-through nil :overline nil :underline nil :slant normal :weight normal :height 1 :width normal :foundry "default" :family "default"))))
; '(custom-comment-tag ((t (:foreground "color-27"))))
; '(custom-group-tag ((t (:inherit variable-pitch :foreground "color-33" :weight bold :height 1.2))))
; '(custom-state ((t (:foreground "green"))))
; '(custom-variable-tag ((t (:foreground "color-33" :weight bold))))
; '(font-lock-string-face ((t (:foreground "brightyellow"))))
; '(font-lock-variable-name-face ((t (:foreground "color-201"))))
; '(highlight ((t (:background "darkseagreen2" :foreground "black"))))
; '(lazy-highlight ((t (:background "paleturquoise" :foreground "black"))))
; '(magit-branch-current ((t (:foreground "brightred" :box 1 :weight bold))))
; '(magit-diff-added-highlight ((t (:inherit magit-diff-added :background "#4c83ff" :foreground "color-16" :weight bold))))
; '(magit-diff-removed ((t (:foreground "brightred"))))
; '(magit-diff-removed-highlight ((t (:inherit magit-diff-removed :background "brightred" :foreground "color-16" :weight bold))))
; '(match ((t (:background "yellow1" :foreground "black"))))
; '(minibuffer-prompt ((t (:foreground "brightcyan"))))
; '(region ((t (:background "lightgoldenrod2" :foreground "black")))))

;; magit
(global-set-key (kbd "C-x g") 'magit-status)

;; commenting
(global-set-key (kbd "C-x C-k c") 'comment-region)
(global-set-key (kbd "C-x C-k u") 'uncomment-region)

;; whitespace commands
(global-set-key (kbd "C-x w") 'pull-next-line)

;; unset C-x C-c for close
(global-unset-key (kbd "C-x C-c"))

;; use temp folder for backups
(setq backup-directory-alist
      `((".*" . ,temporary-file-directory)))
(setq auto-save-file-name-transforms
      `((".*" ,temporary-file-directory t)))

;; function to output face at cursor
(defun what-face (pos)
  (interactive "d")
  (let ((face (or (get-char-property (pos) 'read-face-name)
                  (get-char-property (pos) 'face))))
    (if face (message "Face: %s" face) (message "No face at %d" pos))))

;; spaces instead of tabs
(setq-default indent-tabs-mode nil)


(defun pull-next-line() 
  (interactive) 
  (move-end-of-line 1) 
  (kill-line)
  (just-one-space))

(add-hook 'json-mode-hook
          (lambda ()
            (make-local-variable 'js-indent-level)
            (setq js-indent-level 2)))

;; org mode timestamp when done
(setq org-log-done 'time)
(setq-default org-display-custom-times t)
(setq org-time-stamp-custom-formats '("%y-%m-%d" . "%y-%m-%d %H:%M:%s "))


;; hide/show blocks
(global-set-key (kbd "C-c s") 'hs-show-block)
(global-set-key (kbd "C-c h") 'hs-hide-block)


;; Allow UTF or composed text from the clipboard, even in the terminal or on
;; non-X systems (like Windows or macOS), where only `STRING' is used.
(setq x-select-request-type '(UTF8_STRING COMPOUND_TEXT TEXT STRING))
;; Save clipboard contents into kill-ring before replacing them
(setq save-interprogram-paste-before-kill t)


;; Explicitly define a width to reduce the cost of on-the-fly computation
(setq-default display-line-numbers-width 3)

;; Show absolute line numbers for narrowed regions to make it easier to tell the
;; buffer is narrowed, and where you are, exactly.
(setq-default display-line-numbers-widen t)

;; Enable line numbers in most text-editing modes. We avoid
;; `global-display-line-numbers-mode' because there are many special and
;; temporary modes where we don't need/want them.
(add-hook 'prog-mode-hook #'display-line-numbers-mode)
(add-hook 'text-mode-hook #'display-line-numbers-mode)
(add-hook 'conf-mode-hook #'display-line-numbers-mode)

;; Fix #2742: cursor is off by 4 characters in `artist-mode'
;; REVIEW Reported upstream https://debbugs.gnu.org/cgi/bugreport.cgi?bug=43811
;; DEPRECATED Fixed in Emacs 28; remove when we drop 27 support
;; (unless EMACS28+
;;  (add-hook 'artist-mode-hook #'doom-disable-line-numbers-h))

(require 'rg)
(rg-enable-default-bindings)
(global-set-key (kbd "M-s") 'rg-project)

