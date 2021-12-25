defmodule Fixer.Discord.Struct.AllowedMentions do
  @derive Jason.Encoder
  defstruct parse: [],
            roles: nil,
            users: nil,
            replied_user: true
end
