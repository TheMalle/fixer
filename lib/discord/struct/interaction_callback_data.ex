defmodule Fixer.Discord.Struct.InteractionCallbackData do
  @derive Jason.Encoder
  defstruct [
    :tts,
    :content,
    :embeds,
    :allowed_mentions,
    :flags,
    :components,
    :attachments
  ]
end
