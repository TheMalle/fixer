defmodule Fixer.Commands.Command do
  @doc """
  Creates a command, or updates it if it already exists, using default settings.
  """
  @callback ensure() :: {:ok, term} | {:error, String.t()}

  @doc """
  Creates a command, or updates it if it already exists.
  """
  @callback ensure(Map.t()) :: {:ok, term} | {:error, String.t()}
end
