defmodule Fixer.Application do
  @moduledoc false
  use Application

  def start(_type, _args) do
    children = [
      Fixer.Consumer
    ]

    opts = [strategy: :one_for_one, name: Fixer.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
