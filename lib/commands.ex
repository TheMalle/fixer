defmodule Fixer.Commands do
  alias Fixer.Commands.Command

  def ensure_global_commands() do
    Command.Global.R.ensure()
  end
end
