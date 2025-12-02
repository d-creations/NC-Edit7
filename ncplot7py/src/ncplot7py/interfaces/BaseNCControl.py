from __future__ import annotations
from abc import ABC, abstractmethod



class NCCanal(ABC):
    """
    Header Class of the NCControl interface to use an NC Control.

    This abstract base class defines the interface for NC control operations.
    
    Methods:
    --------
    get_name() -> str:
        Returns the name of the canal.
    
    run_nc_code_list(linked_code_list: LinkedNCCodeList) -> None:
        Runs the NC Program using the provided linked code list.
    
    get_tool_path() -> list:
        Returns the tool path stored in the object as a list of points.
    
    get_exec_nodes() -> list:
        Returns the list of executed NC nodes.
    """



    @abstractmethod    
    def get_name(self) -> str:
        """
        return the name of the canal
        """
        pass

    @abstractmethod
    def run_nc_code_list(self, linked_code_list: LinkedNCCodeList) -> None:
        """
        runs the NC Program
        """
        pass
    @abstractmethod
    def get_tool_path(self) -> list:  # list of Points
        """
        returns the Tool path stored in the object
        """
        pass

    @abstractmethod
    def get_exec_nodes(self) -> list:  # list of Nodes Executed 
        """
        returns the the List of Executed NC Nodes
        """
        pass