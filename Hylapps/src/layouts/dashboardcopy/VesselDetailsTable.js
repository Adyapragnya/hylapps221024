import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import axios from 'axios';
import { Button, Menu, MenuItem, Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,InputLabel } from '@mui/material';
import Swal from 'sweetalert2';
import { CSVLink } from 'react-csv';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DeleteIcon from '@mui/icons-material/Delete';
import './Swal.css';

const VesselDetailsTable = ({ highlightRow, onRowClick }) => {
  const [vessels, setVessels] = useState([]);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [settingsAnchorEl, setSettingsAnchorEl] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [customData, setCustomData] = useState({
    name: '',
    type: '',
    imo: '',
    eta: '',
    destination: '',
    speed: '',
    latitude: '',
    longitude: '',
    heading: '',
    zone: '',
  });

  useEffect(() => {
    const fetchVessels = async () => {
      try {
        const baseURL = process.env.REACT_APP_API_BASE_URL;
        const response = await axios.get(`${baseURL}/api/get-tracked-vessels`);

        const formattedData = response.data
          .filter(vessel => vessel.trackingFlag)
          .map(vessel => ({
            NAME: vessel.AIS?.NAME || '',
            TYPE: vessel.SpireTransportType || '',
            IMO: vessel.AIS?.IMO || 0,
            ETA: vessel.AIS?.ETA || '',
            SPEED: vessel.AIS?.SPEED || 0,
            LATITUDE: vessel.AIS?.LATITUDE || 0,
            LONGITUDE: vessel.AIS?.LONGITUDE || 0,
            DESTINATION: vessel.AIS?.DESTINATION || '',
            HEADING: vessel.AIS?.HEADING || '',
            ZONE: vessel.AIS?.ZONE || '',
            selected: false,
            isNew: isNewVessel(vessel),
          }));

        setVessels(formattedData.reverse());
      } catch (error) {
        console.error('Error fetching tracked vessels:', error);
        setError(error.message);
      }
    };

    fetchVessels();
  }, []);

  const isNewVessel = (vessel) => {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return new Date(vessel.timestamp) > oneMinuteAgo;
  };

  const handleRowClick = (row) => {
    const { NAME, IMO, LATITUDE, LONGITUDE, HEADING, ETA, DESTINATION } = row.data;
    onRowClick({ name: NAME, imo: IMO, lat: LATITUDE, lng: LONGITUDE, heading: HEADING, eta: ETA, destination: DESTINATION });
  };

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
  };

  const filteredVessels = vessels.filter(vessel =>
    Object.values(vessel).some(value =>
      value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  );

  const handleRowSelection = (rowData) => {
    const updatedVessels = vessels.map(vessel => {
      if (vessel.IMO === rowData.IMO) {
        return { ...vessel, selected: !vessel.selected }; // Toggle selected state
      }
      return vessel;
    });

    setVessels(updatedVessels);
    const newSelectedRows = updatedVessels.filter(vessel => vessel.selected);
    setSelectedRows(newSelectedRows.map(vessel => vessel.IMO));
  };

  const handleDeleteSelected = async () => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "Do you want to delete selected vessels from tracking?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      customClass: {
        popup: 'custom-swal',
      },
    });

    if (result.isConfirmed) {
      const baseURL = process.env.REACT_APP_API_BASE_URL;

      try {
        await Promise.all(
          selectedRows.map(async (imo) => {
            await axios.patch(`${baseURL}/api/delete-vessel`, {
              imoNumber: imo,
              trackingFlag: false, // Set trackingFlag to false
            });
          })
        );

        const updatedVessels = vessels.filter(vessel => !vessel.selected);
        setVessels(updatedVessels);
        setSelectedRows([]); // Clear selected rows

        Swal.fire('Deleted!', 'Your selected vessels have been deleted.', 'success').then(() => {
          // Refresh the page
          location.reload();
      });

      } catch (error) {
        console.error('Error updating vessels:', error);
        Swal.fire('Error!', 'There was an error deleting the vessels.', 'error');
      }
    }
  };

  const columns = [
    { 
      name: 'select', 
      header: '', 
      defaultWidth: 50, 
      headerAlign: 'center', 
      align: 'center', 
      flex: 0.2,
      render: ({ data }) => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <input 
            type="checkbox" 
            checked={data.selected} 
            onChange={() => handleRowSelection(data)} 
            style={{ width: '20px', height: '20px' }}
          />
        </div>
      ),
    },
    { name: 'NAME', header: 'Name', minWidth: 200, flex: 2 },
    { name: 'TYPE', header: 'Type', minWidth: 200, flex: 2 },
    { name: 'IMO', header: 'IMO', minWidth: 200, flex: 2 },
    { name: 'ETA', header: 'ETA', minWidth: 200, flex: 2 },
    { name: 'DESTINATION', header: 'Destination', minWidth: 200, flex: 2 },
    { name: 'SPEED', header: 'Speed', minWidth: 200, flex: 2 },
    { name: 'LATITUDE', header: 'Latitude', minWidth: 200, flex: 2 },
    { name: 'LONGITUDE', header: 'Longitude', minWidth: 200, flex: 2 },
    { name: 'HEADING', header: 'Heading', minWidth: 200, flex: 2 },
    { name: 'ZONE', header: 'Zone', minWidth: 200, flex: 2 },
    { name: 'Order No', header: 'Order No', minWidth: 200, flex: 2 },
    { name: 'Order Status', header: 'Order Status', minWidth: 200, flex: 2 },
  ];

  const csvHeaders = columns.map(c => ({ label: c.header, key: c.name }));
  const csvData = filteredVessels;

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Vessel Details', 20, 10);
    doc.autoTable({
      head: [columns.map(c => c.header)],
      body: filteredVessels.map(vessel => columns.map(c => vessel[c.name] || '')),
    });
    doc.save('vessel-details.pdf');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Vessel Details</title>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h2>Vessel Details</h2>');
    printWindow.document.write('<table border="1" style="width: 100%; border-collapse: collapse;">');
    printWindow.document.write('<thead><tr>');
    columns.forEach(col => {
      printWindow.document.write(`<th style="background-color: blue; color: white; text-align: center;">${col.header}</th>`);
    });
    printWindow.document.write('</tr></thead><tbody>');
    filteredVessels.forEach(vessel => {
      printWindow.document.write('<tr>');
      columns.forEach(col => {
        printWindow.document.write(`<td>${vessel[col.name] || ''}</td>`);
      });
      printWindow.document.write('</tr>');
    });
    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  const handleFullScreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
  };

  const handleSettingsMenuOpen = (event) => {
    setSettingsAnchorEl(event.currentTarget);
  };

  const handleSettingsMenuClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomData({
      ...customData,
      [name]: value,
    });
  };

  const handleOpenModal = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleAddCustomData = () => {
    // Logic to add custom data goes here
    console.log(customData);
    // You can also push the new data into the vessels state if needed
    handleCloseModal();
  };

  

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <div>
          <Button
            variant="contained"
            color="primary"
            onClick={handleDeleteSelected}
            startIcon={<DeleteIcon />}
            disabled={selectedRows.length === 0}
          >
            Delete
          </Button>
          <Button
            aria-controls={exportAnchorEl ? 'export-menu' : undefined}
            aria-haspopup="true"
            onClick={event => setExportAnchorEl(event.currentTarget)}
            style={{ 
              marginLeft: '8px', 
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '10px 15px'
            }}
          >
            <i className='fa fa-database'></i> &nbsp;
            Export
          </Button>
          {/* <Button
            aria-controls={settingsAnchorEl ? 'settings-menu' : undefined}
            aria-haspopup="true"
            onClick={handleSettingsMenuOpen}
            style={{ 
              marginLeft: '8px', 
              backgroundColor: '#2196F3', 
              color: 'white', 
              padding: '10px 15px' 
            }}
          >
            <i className='fa fa-cogs'></i> &nbsp;
            Custom Data
          </Button> */}
          <Menu
            id="settings-menu"
            anchorEl={settingsAnchorEl}
            open={Boolean(settingsAnchorEl)}
            onClose={handleSettingsMenuClose}
          >
            {/* <MenuItem onClick={handleFullScreen}><i className="fa-solid fa-maximize"></i>&nbsp;Create Custom Field</MenuItem> */}
            <MenuItem onClick={handleOpenModal}><i className="fa-solid fa-table"></i>&nbsp;Add Custom Data</MenuItem>
          </Menu>
          <Menu
            id="export-menu"
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={() => setExportAnchorEl(null)}
          >
            <MenuItem onClick={exportPDF}>
              <i className="fa-solid fa-file-pdf"></i> &nbsp;PDF
            </MenuItem>
            <CSVLink
              data={csvData}
              headers={csvHeaders}
              filename="vessel-details.csv"
              onClick={() => setExportAnchorEl(null)}
            >
              <MenuItem>
                <i className="fa-solid fa-file-excel"></i>&nbsp;CSV
              </MenuItem>
            </CSVLink>
            <MenuItem onClick={handlePrint}>
              <i className="fa-solid fa-print"></i>&nbsp;Print
            </MenuItem>
          </Menu>
        </div>
        <input 
          type="text" 
          placeholder="Search" 
          value={searchValue} 
          onChange={handleSearchChange} 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} 
        />
      </Box>
      <ReactDataGrid
        idProperty="IMO"
        columns={columns}
        dataSource={filteredVessels}
        pagination
        paginationPageSize={10}
        style={{ height: '440px' }}
        rowHeight={50}
        onRowClick={handleRowClick}
        highlightRow={highlightRow}
      />

  {/* Modal for adding custom vessel data */}
<Dialog open={openModal} onClose={handleCloseModal} maxWidth="sm" fullWidth>
    <DialogTitle>Add Custom Vessel Data</DialogTitle>
    <DialogContent>
        <FormControl fullWidth margin="dense">
            <InputLabel>Header</InputLabel>
            <TextField
                autoFocus
                name="name"
                type="text"
                value={customData.name}
                onChange={handleInputChange}
                variant="outlined"
                style={{ marginTop: '8px' }} // Spacing between label and input
            />
        </FormControl>
        <FormControl fullWidth margin="dense" style={{ marginTop: '16px' }}>
            <InputLabel>Data</InputLabel>
            <TextField
                name="type"
                type="text"
                value={customData.type}
                onChange={handleInputChange}
                variant="outlined"
                style={{ marginTop: '8px' }} // Spacing between label and input
            />
        </FormControl>
    </DialogContent>
    <DialogActions>
        <Box display="flex" justifyContent="center" width="100%">
            <Button 
                onClick={handleCloseModal} 
                color="primary" 
                style={{ backgroundColor: '#f44336', color: 'white' }} // Red for Cancel
            >
                Cancel
            </Button>
            <Button 
                onClick={handleAddCustomData} 
                color="primary" 
                style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '8px' }} // Green for Add
            >
                Add
            </Button>
        </Box>
    </DialogActions>
</Dialog>


    </div>
  );
};

VesselDetailsTable.propTypes = {
  highlightRow: PropTypes.string.isRequired,
  onRowClick: PropTypes.func.isRequired,
};

export default VesselDetailsTable;
