"""     CNC NC-Code toolphat caculations for Plot
    Copyright (C) <2024>  <Damian Roth Switzerland

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. 
"""

from __future__ import annotations
from abc import ABC, abstractmethod


class NCControl(ABC):
    """
    Header Class of the NCContol interface to uses a NC Controll
    ...

    Attributes
    ----------

    count_of_canals : int
        The count of the Canals the NC should have
    canal_names : string
        name of the canals 
    init_nc_states : list[NCState]
        A list of the Init NC-State for each Canal

    Methods
    -------
    __init__(self, count_of_canals, init_nc_states:list[NCState]) -> None:
        Initalisation of the New Object
    run_nc_code_list(self, linked_code_list: LinkedNCCodeList, canal: int) -> None:
        runs the NC Program 

    get_tool_path(self, canal: int) -> list[tuple[list[Point], int]]:  # list of Points
        returns the Tool path stored in the object
    
    synchro_points(tool_paths,exec_nodes) -> None:
        Synchronisation of the Time of the NC nodes while the Canals waits for each other

    get_canal_count(self)-> int:
        returns the count of canals 
    get_exected_nodes(self, canal: int) -> list[NCNode]: 
        returns the the List of Executed NC Nodes
    """


    @abstractmethod
    def get_canal_name(self, canal : int) -> str:
        """return the name of the canal
        
        Parameters:
        ----------
        canal: int
            define in which Canal the name should be returned

        Returns:
        -------
        str
            the name
        """
        pass

    @abstractmethod
    def __init__(self, count_of_canals,canal_names:str, init_nc_states:list[NCState]) -> None:
        """Initalisation of Object

        Parameters:
        ----------
        count_of_canals : int
            The count of the Canals the NC should have
        canal_names : string
            name of the canals 
        init_nc_states : list[NCState]
            A list of the Init NC-State for each Canal

        Returns:
        -------
        None
            Nothing
       """
        pass

    @abstractmethod
    def run_nc_code_list(self, linked_code_list: LinkedNCCodeList, canal: int) -> None:
        """runs the NC Program 

        Parameters:
        ----------
        linked_code_list: LinkedNCCodeList
            A List of NCCode Nodes to be executetd
        canal: int
            define in which Canal of the NC Program the Program should be run

        Returns:
        -------
        None

        Raises
        ------
        NCCommandTONCCommandNodeMapperException
            If the blank NC-Code could not be map in to NC Nodes       
        NCControlException      
            IF there was a problem with the values given
        Execption
            IF there was a problem while run the Program  CNC Errors 
       """
        pass

    @abstractmethod
    def get_tool_path(self, canal: int) -> list[tuple[list[Point], int]]:  # list of Points
        """returns the Tool path stored in the object

        Parameters:
        ----------
        canal: int
            define in which Canal the tool path should be returned

        Returns:
        -------
        list[tuple[list[Points], int]]
            returns a list with a Tuple of each NC-Executed Node Line that contains 
            a List of Point of the current Line and the Time

        Raises
        ------
        NCControlException
            If the selected Canal does not exist      
        """
        pass

    @abstractmethod
    def get_exected_nodes(self, canal: int) -> list[NCNode]: 
        """returns the the List of Executed NC Nodes

        Parameters:
        ----------
        canal: int
            define in which Canal the tool path should be returned

        Returns:
        -------
        list[NCNode]: 
            List of Node executed

        Raises
        ------   
        """
        pass 

    @abstractmethod       
    def get_canal_count(self)-> int:
        """
        returns the count of canals 

        Returns:
        -------
        int: 
            count of Canals of this NC
        """
        pass

    @abstractmethod  
    def synchro_points(self,tool_paths,exec_nodes) -> None:
        """
        Synchronisation of the Time of the NC nodes while the Canals waits for each other

        Returns:
        -------
        None: 
            the change chould be made as a side effect
        """
        pass