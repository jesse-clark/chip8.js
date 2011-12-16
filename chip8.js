var startup = new function() {
    this.width = 64;
    this.height = 32;
    this.canvas = document.getElementById('c');
    this.ctx =  this.canvas.getContext('2d');
}


var chip8 = new function() {
    this.opcode;  //16 bits
    this.memory = new Array(4096);
    this.V = new Array(16);//0-14 8-bit 15 - carry bit
    this.I; //000-FFF index register
    this.pc;//000-FFF program counter
    this.gfx = new Array(64 * 32);
    this.delay_timer;
    this.sound_timer;
    this.stack = new Array(16);
    this.sp;
    this.key = new Array(16);
    
    this.drawFlag;

    this.status_box = function( msg ) {
        document.getElementById("status").value += msg + "\n";
    }

    this.initialize = function() {
        this.pc     = 0x200;
        this.opcode = 0;
        this.I      = 0;
        this.sp     = 0;

        //clear display
        for( var i = 0; i < this.gfx.length; i += 1 ) {
            this.gfx[i] = 0;
        }

        //clear stack
        for( var i = 0; i < this.stack.length; i += 1 ) {
            this.stack[i] = 0;
        }

        //clear V
        for( var i = 0; i < this.V.length; i += 1 ) {
            this.V[i] = 0;
        }

        //clear memory
        for( var i = 0; i < this.memory.length; i += 1 ) {
            this.memory[i] = 0;
        }

        //load fontset
        for( var i = 0; i < chip8_fontset.length; i += 1 ) {
            this.memory[i] = chip8_fontset[i];
        }

        this.delay_timer = 0;
        this.sound_timer = 0;

    }

    this.loadGame = function() {
        for( var i = 0; i < IBM_Logo.length; i += 1 ) {
            this.memory[i + 512] = IBM_Logo[i];
        }
    }
    
    this.emulateCycle = function() {
        this.opcode = this.memory[this.pc] << 8 | this.memory[this.pc + 1];
        
        switch( this.opcode & 0xF000 ) {
            case 0x0000:
                switch( this.opcode & 0x00FF ) {
                    case 0x00E0:
                        for( var i = 0; i < this.gfx.length; i += 1 ) {
                            this.gfx[i] = 0;
                        }
                        this.drawFlag = true;
                        this.pc += 2;
                        break;
                    case 0x00EE:
                        this.sp -= 1;
                        this.pc = this.stack[this.sp];
                        this.pc +=2;
                        break
                    default:
                        this.status_box( "Unkown opcode [0x0000]: 0x" + this.opcode.toString(16) );
                }
                break;

            case 0x1000:
                this.pc = this.opcode & 0x0FFF;
                break;

            case 0x2000:
                this.stack[this.sp] = this.pc;
                this.sp += 1;
                this.pc = this.opcode & 0x0FFF;
                break;

            case 0x3000:
                if( this.V[ (this.opcode & 0x0F00) >> 8 ] === ( this.opcode & 0x00FF ) ) {
                    this.pc += 4;
                } else {
                    this.pc += 2;
                }
                break;

            case 0x4000:
                if( this.V[ (this.opcode & 0x0F00) >> 8 ] !== ( this.opcode & 0x00FF ) ) {
                    this.pc += 4;
                } else {
                    this.pc += 2;
                }
                break;

            case 0x5000:
                if( this.V[ (this.opcode & 0x0F00) >> 8 ] === this.V[ (this.opcode & 0x00F0) >> 4 ] ) {
                    this.pc += 4;
                } else {
                    this.pc += 2;
                }
                break;

            case 0x6000:
                this.V[ (this.opcode & 0x0F00) >> 8 ] = ( this.opcode & 0x00FF );
                this.pc += 2;
                break;

            case 0x7000:
                this.V[ (this.opcode & 0x0F00) >> 8 ] += ( this.opcode & 0x00FF );
                this.pc += 2;
                break;

            case 0x8000: //0x8XYN switch on N
                var X8 = ( this.opcode & 0x0F00 ) >> 8;
                var Y8 = ( this.opcode & 0x00F0 ) >> 4;
                switch( this.opcode & 0x000F ) {
                    case 0x0000: // Set VX to the value of VY
                        this.V[ X8 ] = this.V[ Y8 ];
                        break;

                    case 0x0001: //Set VX to VX or VY
                        this.V[ X8 ] = ( this.V[ X8 ] | this.V[ Y8 ] );
                        break;

                    case 0x0002: //Set VX to VX and VY
                        this.V[ X8 ] = ( this.V[ X8 ] & this.V[ Y8 ] );
                        break;

                    case 0x0003: //Set VX to VX xor VY
                        this.V[ X8 ] = ( this.V[ X8 ] ^ this.V[ Y8 ] );
                        break;

                    case 0x0004: //Adds VY to VX. Set VF if carry
                        this.V[ X8 ] += this.V[ Y8 ];
                        if( this.V[ X8 ] > 0xFFFF ) {
                            this.V[ 0xF ] = 1;
                            this.V[ X8 ] &= 0xFFFF;
                        } else {
                            this.V[ 0xF ] = 0;
                        }
                        break;

                    case 0x0005: //VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
                        if( Y8 > X8 ) {       //First we set VF
                            this.V[0xF] = 0;
                        } else {
                            this.V[0xF] = 1;
                        }
                        this.V[ X8 ] -= this.V[ Y8 ]; //do the subtraction
                        this.V[ X8 ] &= 0xFFFF;       //mask in case of negative
                        break;

                    case 0x0006: //Shifts VX right by one. VF is set to the value of the least significant bit of VX before the shift.
                        this.V[0xF] = this.V[ X8 ] & 0x0001;
                        this.V[ X8 ] = (this.V[ X8 ] >> 1) & 0xFFFF;
                        break;

                    case 0x0007: //Sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
                        if( X8 > Y8 ) {
                            this.V[0xF] = 0;
                        } else {
                            this.V[0xF] = 1;
                        }
                        this.V[ X8 ] = this.V[ Y8 ] - this.V[ X8 ];
                        this.V[ X8 ] &= 0xFFFF;
                        break;

                    case 0x000E: //Shifts VX left by one. VF is set to the value of the most significant bit of VX before the shift.
                        this.V[0xF] = this.V[ XB ] & 0x8000;
                        this.V[ XB ] = (this.V[ XB] << 1) & 0xFFFF;
                        break;

                    default:
                        this.status_box( "Unkown opcode [0x8000]: 0x" + this.opcode.toString(16) );
                }
                this.pc += 2;
                break;

            case 0x9000: //Skips the next instruction if VX doesn't equal VY.
                if( this.V[ (this.opcode & 0x0F00) >> 8 ] !== this.V[ (this.opcode & 0x00F0) >> 4 ] ) {
                    this.pc += 4;
                } else {
                    this.pc += 2;
                }
                break;

            case 0xA000: //Sets I to the address NNN.
                this.I = (this.opcode & 0x0FFF);
                this.pc +=2;
                break;

            case 0xB000: //Jumps to the address NNN plus V0.
                this.I = (this.opcode & 0x0FFF) + this.V[0];
                this.pc += 2;
                break;

            case 0xC000: //Sets VX to a random number and NN.
                this.V[ (this.opcode & 0x0F00) >> 8 ] = ( Math.floor(Math.random() * 0xFF) & (this.opcode & 0x00FF) );
                this.pc += 2;
                break;

            case 0xD000: //Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels. 
                         //Each row of 8 pixels is read as bit-coded (with the most significant bit of each byte 
                         //displayed on the left) starting from memory location I; I value doesn't change after the 
                         //execution of this instruction. As described above, VF is set to 1 if any screen pixels are 
                         //flipped from set to unset when the sprite is drawn, and to 0 if that doesn't happen.
                var xd = this.V[(this.opcode & 0x0F00) >> 8];
                var yd = this.V[(this.opcode & 0x00F0) >> 4];
                var height = this.opcode & 0x000F;
                var pixel;
                this.V[0xF] = 0;

                for( var yline = 0; yline < height; yline++ ) {
                    pixel = this.memory[this.I + yline];

                    for( var xline = 0; xline < 8; xline++) {
                        if( (pixel & (0x80 >> xline)) !== 0) {
                            if(this.gfx[(xd + xline + ((yd + yline) * 64))] === 1) {
                                this.V[0xF] = 1;
                            }
                            this.gfx[ xd + xline + (( yd + yline ) * 64) ] ^= 1;
                        }
                    }
                }

                this.drawFlag = true;
                this.pc += 2;
                break;

            case 0xE000:
                switch( this.opcode & 0x00FF) {
                    case 0x009E: //Skips the next instruction if the key stored in VX is pressed.
                        if( this.key[this.V[ (this.opcode & 0x0F00) >> 8]] === 1) {
                            this.pc += 4;
                        } else {
                            this.pc += 2;
                        }
                        break;

                    case 0x00A1: //Skips the next instruction if the key stored in VX isn't pressed.
                        if( this.key[this.V[ (this.opcode & 0x0F00) >> 8]] !== 1) {
                            this.pc += 4;
                        } else {
                            this.pc += 2;
                        }
                        break;


                    default:
                        this.status_box( "Unknown opcode [0xE000]: 0x" + this.opcode.toString(16) );
                }
                break;

            case 0xF000:
                switch(this.opcode & 0x00FF) {
                    case 0x0007: //Sets VX to the value of the delay timer.
                        this.V[ (this.opcode & 0x0F00) >> 8] = this.delay_timer;
                        this.pc += 2;
                        break;

                    case 0x000A: //A key press is awaited, and then stored in VX.
                        var keypress = false;

                        for( var i = 0; i < 16; i +=1) {
                            if(this.key[i] == 1) {
                                this.V[ (this.opcode & 0x0F00) >> 8 ] = i;
                                keypress = true;
                            }
                        }

                        if(!keypress) {
                            return;
                        }

                        this.pc += 2;
                        break;

                    case 0x0015: //Sets the delay timer to VX.
                        this.delay_timer = this.V[ (this.opcode & 0x0F00) >> 8 ];
                        this.pc += 2;
                        break;

                    case 0x0018: //Sets the sound timer to VX.
                        this.sound_timer = this.V[ (this.opcode & 0x0F00) >> 8 ];
                        this.pc += 2;
                        break;

                    case 0x001E: //Adds VX to I. VF set to 1 if overflow
                        if( (this.I + this.V[ (this.opcode & 0x0F00) >> 8]) > 0xFFF) {
                            this.V[0xF] = 1;
                        } else {
                            this.V[0xF] = 0;
                        }
                        this.I = ( this.I + this.V[ (this.opcode & 0x0F00) >> 8 ] ) & 0xFFF;
                        this.pc += 2;
                        break;

                    case 0x0029: //Sets I to the location of the sprite for the character in VX. 
                                 //Characters 0-F (in hexadecimal) are represented by a 4x5 font.
                        this.I = this.V[ (this.opcode & 0x0F00) >> 8] * 0x5;
                        this.pc += 2;
                        break;

                    case 0x0033: //Stores the Binary-coded decimal representation of VX, with the most 
                                 //significant of three digits at the address in I, the middle digit at 
                                 //I plus 1, and the least significant digit at I plus 2.
                        var v0 = this.V[ (this.opcode & 0x0F00) >> 8];
                        this.memory[this.I]     = Math.floor( v0 / 100);
                        this.memory[this.I + 1] = Math.floor( v0 / 10) % 10;
                        this.memory[this.I + 2] = Math.floor( v0 % 10) % 10;
                        this.pc += 2;
                        break;

                    case 0x0055: //Stores V0 to VX in memory starting at address I.
                        for( var i = 0; i <= ((this.opcode & 0x0F00) >> 8); i += 1) {
                            this.memory[this.I + i] = this.V[i];
                        }
                        this.I += ((this.opcode & 0x0F00) >> 8) + 1;
                        this.pc += 2;
                        break;

                    case 0x0065: //Fills V0 to VX with values from memory starting at address I.
                        for( var i = 0; i <= ((this.opcode & 0x0F00) >> 8); i += 1) {
                            this.V[i] = this.memory[this.I + i];
                        }
                        this.I += ((this.opcode & 0x0F00) >> 8) + 1;
                        this.pc += 2;
                        break;

                    default: 
                        this.status_box( "Unknown opcode [0xF000]: 0x" + this.opcode.toString(16) );
                }
                break;

            default:
                this.status_box( "Unknown opcode: 0x" + this.opcode.toString(16) );
        }

        if( this.delay_timer > 0 ) {
            this.delay_timer -= 1;
        }

        if( this.sound_timer > 0 ) {
            if( this.sound_timer === 1 ) {
                this.status_box("BEEP!");
            }
            this.sound_timer -= 1;
        }
    }

    var chip8_fontset = new Array(
        0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
        0x20, 0x60, 0x20, 0x20, 0x70, // 1
        0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
        0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
        0x90, 0x90, 0xF0, 0x10, 0x10, // 4
        0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
        0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
        0xF0, 0x10, 0x20, 0x40, 0x40, // 7
        0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
        0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
        0xF0, 0x90, 0xF0, 0x90, 0x90, // A
        0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
        0xF0, 0x80, 0x80, 0x80, 0xF0, // C
        0xE0, 0x90, 0x90, 0x90, 0xE0, // D
        0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
        0xF0, 0x80, 0xF0, 0x80, 0x80  // F
    );
    /*
     
                            ==========================
                              Game section of Chip-8    
                            ==========================
     
    */
    var Pong = new Array(
        0x6a, 0x02, 0x6b, 0x0c, 0x6c, 0x3f, 0x6d, 0x0c, 0xa2, 0xea, 0xda, 0xb6,
        0xdc, 0xd6, 0x6e, 0x00, 0x22, 0xd4, 0x66, 0x03, 0x68, 0x02, 0x60, 0x60,
        0xf0, 0x15, 0xf0, 0x07, 0x30, 0x00, 0x12, 0x1a, 0xc7, 0x17, 0x77, 0x08,
        0x69, 0xff, 0xa2, 0xf0, 0xd6, 0x71, 0xa2, 0xea, 0xda, 0xb6, 0xdc, 0xd6,
        0x60, 0x01, 0xe0, 0xa1, 0x7b, 0xfe, 0x60, 0x04, 0xe0, 0xa1, 0x7b, 0x02,
        0x60, 0x1f, 0x8b, 0x02, 0xda, 0xb6, 0x60, 0x0c, 0xe0, 0xa1, 0x7d, 0xfe,
        0x60, 0x0d, 0xe0, 0xa1, 0x7d, 0x02, 0x60, 0x1f, 0x8d, 0x02, 0xdc, 0xd6,
        0xa2, 0xf0, 0xd6, 0x71, 0x86, 0x84, 0x87, 0x94, 0x60, 0x3f, 0x86, 0x02,
        0x61, 0x1f, 0x87, 0x12, 0x46, 0x02, 0x12, 0x78, 0x46, 0x3f, 0x12, 0x82,
        0x47, 0x1f, 0x69, 0xff, 0x47, 0x00, 0x69, 0x01, 0xd6, 0x71, 0x12, 0x2a,
        0x68, 0x02, 0x63, 0x01, 0x80, 0x70, 0x80, 0xb5, 0x12, 0x8a, 0x68, 0xfe,
        0x63, 0x0a, 0x80, 0x70, 0x80, 0xd5, 0x3f, 0x01, 0x12, 0xa2, 0x61, 0x02,
        0x80, 0x15, 0x3f, 0x01, 0x12, 0xba, 0x80, 0x15, 0x3f, 0x01, 0x12, 0xc8,
        0x80, 0x15, 0x3f, 0x01, 0x12, 0xc2, 0x60, 0x20, 0xf0, 0x18, 0x22, 0xd4,
        0x8e, 0x34, 0x22, 0xd4, 0x66, 0x3e, 0x33, 0x01, 0x66, 0x03, 0x68, 0xfe,
        0x33, 0x01, 0x68, 0x02, 0x12, 0x16, 0x79, 0xff, 0x49, 0xfe, 0x69, 0xff,
        0x12, 0xc8, 0x79, 0x01, 0x49, 0x02, 0x69, 0x01, 0x60, 0x04, 0xf0, 0x18,
        0x76, 0x01, 0x46, 0x40, 0x76, 0xfe, 0x12, 0x6c, 0xa2, 0xf2, 0xfe, 0x33,
        0xf2, 0x65, 0xf1, 0x29, 0x64, 0x14, 0x65, 0x00, 0xd4, 0x55, 0x74, 0x15,
        0xf2, 0x29, 0xd4, 0x55, 0x00, 0xee, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
        0x80, 0x00, 0x00, 0x00, 0x00, 0x00
    );

    var Space_Invaders = new Array(
        0x12, 0x25, 0x53, 0x50, 0x41, 0x43, 0x45, 0x20, 0x49, 0x4e, 0x56, 0x41,
        0x44, 0x45, 0x52, 0x53, 0x20, 0x30, 0x2e, 0x39, 0x31, 0x20, 0x42, 0x79,
        0x20, 0x44, 0x61, 0x76, 0x69, 0x64, 0x20, 0x57, 0x49, 0x4e, 0x54, 0x45,
        0x52, 0x60, 0x00, 0x61, 0x00, 0x62, 0x08, 0xa3, 0xdd, 0xd0, 0x18, 0x71,
        0x08, 0xf2, 0x1e, 0x31, 0x20, 0x12, 0x2d, 0x70, 0x08, 0x61, 0x00, 0x30,
        0x40, 0x12, 0x2d, 0x69, 0x05, 0x6c, 0x15, 0x6e, 0x00, 0x23, 0x91, 0x60,
        0x0a, 0xf0, 0x15, 0xf0, 0x07, 0x30, 0x00, 0x12, 0x4b, 0x23, 0x91, 0x7e,
        0x01, 0x12, 0x45, 0x66, 0x00, 0x68, 0x1c, 0x69, 0x00, 0x6a, 0x04, 0x6b,
        0x0a, 0x6c, 0x04, 0x6d, 0x3c, 0x6e, 0x0f, 0x00, 0xe0, 0x23, 0x75, 0x23,
        0x51, 0xfd, 0x15, 0x60, 0x04, 0xe0, 0x9e, 0x12, 0x7d, 0x23, 0x75, 0x38,
        0x00, 0x78, 0xff, 0x23, 0x75, 0x60, 0x06, 0xe0, 0x9e, 0x12, 0x8b, 0x23,
        0x75, 0x38, 0x39, 0x78, 0x01, 0x23, 0x75, 0x36, 0x00, 0x12, 0x9f, 0x60,
        0x05, 0xe0, 0x9e, 0x12, 0xe9, 0x66, 0x01, 0x65, 0x1b, 0x84, 0x80, 0xa3,
        0xd9, 0xd4, 0x51, 0xa3, 0xd9, 0xd4, 0x51, 0x75, 0xff, 0x35, 0xff, 0x12,
        0xad, 0x66, 0x00, 0x12, 0xe9, 0xd4, 0x51, 0x3f, 0x01, 0x12, 0xe9, 0xd4,
        0x51, 0x66, 0x00, 0x83, 0x40, 0x73, 0x03, 0x83, 0xb5, 0x62, 0xf8, 0x83,
        0x22, 0x62, 0x08, 0x33, 0x00, 0x12, 0xc9, 0x23, 0x7d, 0x82, 0x06, 0x43,
        0x08, 0x12, 0xd3, 0x33, 0x10, 0x12, 0xd5, 0x23, 0x7d, 0x82, 0x06, 0x33,
        0x18, 0x12, 0xdd, 0x23, 0x7d, 0x82, 0x06, 0x43, 0x20, 0x12, 0xe7, 0x33,
        0x28, 0x12, 0xe9, 0x23, 0x7d, 0x3e, 0x00, 0x13, 0x07, 0x79, 0x06, 0x49,
        0x18, 0x69, 0x00, 0x6a, 0x04, 0x6b, 0x0a, 0x6c, 0x04, 0x7d, 0xf4, 0x6e,
        0x0f, 0x00, 0xe0, 0x23, 0x51, 0x23, 0x75, 0xfd, 0x15, 0x12, 0x6f, 0xf7,
        0x07, 0x37, 0x00, 0x12, 0x6f, 0xfd, 0x15, 0x23, 0x51, 0x8b, 0xa4, 0x3b,
        0x12, 0x13, 0x1b, 0x7c, 0x02, 0x6a, 0xfc, 0x3b, 0x02, 0x13, 0x23, 0x7c,
        0x02, 0x6a, 0x04, 0x23, 0x51, 0x3c, 0x18, 0x12, 0x6f, 0x00, 0xe0, 0xa4,
        0xdd, 0x60, 0x14, 0x61, 0x08, 0x62, 0x0f, 0xd0, 0x1f, 0x70, 0x08, 0xf2,
        0x1e, 0x30, 0x2c, 0x13, 0x33, 0x60, 0xff, 0xf0, 0x15, 0xf0, 0x07, 0x30,
        0x00, 0x13, 0x41, 0xf0, 0x0a, 0x00, 0xe0, 0xa7, 0x06, 0xfe, 0x65, 0x12,
        0x25, 0xa3, 0xc1, 0xf9, 0x1e, 0x61, 0x08, 0x23, 0x69, 0x81, 0x06, 0x23,
        0x69, 0x81, 0x06, 0x23, 0x69, 0x81, 0x06, 0x23, 0x69, 0x7b, 0xd0, 0x00,
        0xee, 0x80, 0xe0, 0x80, 0x12, 0x30, 0x00, 0xdb, 0xc6, 0x7b, 0x0c, 0x00,
        0xee, 0xa3, 0xd9, 0x60, 0x1c, 0xd8, 0x04, 0x00, 0xee, 0x23, 0x51, 0x8e,
        0x23, 0x23, 0x51, 0x60, 0x05, 0xf0, 0x18, 0xf0, 0x15, 0xf0, 0x07, 0x30,
        0x00, 0x13, 0x89, 0x00, 0xee, 0x6a, 0x00, 0x8d, 0xe0, 0x6b, 0x04, 0xe9,
        0xa1, 0x12, 0x57, 0xa6, 0x0c, 0xfd, 0x1e, 0xf0, 0x65, 0x30, 0xff, 0x13,
        0xaf, 0x6a, 0x00, 0x6b, 0x04, 0x6d, 0x01, 0x6e, 0x01, 0x13, 0x97, 0xa5,
        0x0a, 0xf0, 0x1e, 0xdb, 0xc6, 0x7b, 0x08, 0x7d, 0x01, 0x7a, 0x01, 0x3a,
        0x07, 0x13, 0x97, 0x00, 0xee, 0x3c, 0x7e, 0xff, 0xff, 0x99, 0x99, 0x7e,
        0xff, 0xff, 0x24, 0x24, 0xe7, 0x7e, 0xff, 0x3c, 0x3c, 0x7e, 0xdb, 0x81,
        0x42, 0x3c, 0x7e, 0xff, 0xdb, 0x10, 0x38, 0x7c, 0xfe, 0x00, 0x00, 0x7f,
        0x00, 0x3f, 0x00, 0x7f, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x03, 0x03,
        0x03, 0x03, 0x00, 0x00, 0x3f, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
        0x20, 0x3f, 0x08, 0x08, 0xff, 0x00, 0x00, 0xfe, 0x00, 0xfc, 0x00, 0xfe,
        0x00, 0x00, 0x00, 0x7e, 0x42, 0x42, 0x62, 0x62, 0x62, 0x62, 0x00, 0x00,
        0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00,
        0xff, 0x00, 0x7d, 0x00, 0x41, 0x7d, 0x05, 0x7d, 0x7d, 0x00, 0x00, 0xc2,
        0xc2, 0xc6, 0x44, 0x6c, 0x28, 0x38, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0xf7, 0x10,
        0x14, 0xf7, 0xf7, 0x04, 0x04, 0x00, 0x00, 0x7c, 0x44, 0xfe, 0xc2, 0xc2,
        0xc2, 0xc2, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0xef, 0x20, 0x28, 0xe8, 0xe8, 0x2f,
        0x2f, 0x00, 0x00, 0xf9, 0x85, 0xc5, 0xc5, 0xc5, 0xc5, 0xf9, 0x00, 0x00,
        0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00,
        0xff, 0x00, 0xbe, 0x00, 0x20, 0x30, 0x20, 0xbe, 0xbe, 0x00, 0x00, 0xf7,
        0x04, 0xe7, 0x85, 0x85, 0x84, 0xf4, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0x00, 0x7f,
        0x00, 0x3f, 0x00, 0x7f, 0x00, 0x00, 0x00, 0xef, 0x28, 0xef, 0x00, 0xe0,
        0x60, 0x6f, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0x00, 0xfe, 0x00, 0xfc, 0x00, 0xfe,
        0x00, 0x00, 0x00, 0xc0, 0x00, 0xc0, 0xc0, 0xc0, 0xc0, 0xc0, 0x00, 0x00,
        0xfc, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0xfc, 0x10, 0x10,
        0xff, 0xf9, 0x81, 0xb9, 0x8b, 0x9a, 0x9a, 0xfa, 0x00, 0xfa, 0x8a, 0x9a,
        0x9a, 0x9b, 0x99, 0xf8, 0xe6, 0x25, 0x25, 0xf4, 0x34, 0x34, 0x34, 0x00,
        0x17, 0x14, 0x34, 0x37, 0x36, 0x26, 0xc7, 0xdf, 0x50, 0x50, 0x5c, 0xd8,
        0xd8, 0xdf, 0x00, 0xdf, 0x11, 0x1f, 0x12, 0x1b, 0x19, 0xd9, 0x7c, 0x44,
        0xfe, 0x86, 0x86, 0x86, 0xfc, 0x84, 0xfe, 0x82, 0x82, 0xfe, 0xfe, 0x80,
        0xc0, 0xc0, 0xc0, 0xfe, 0xfc, 0x82, 0xc2, 0xc2, 0xc2, 0xfc, 0xfe, 0x80,
        0xf8, 0xc0, 0xc0, 0xfe, 0xfe, 0x80, 0xf0, 0xc0, 0xc0, 0xc0, 0xfe, 0x80,
        0xbe, 0x86, 0x86, 0xfe, 0x86, 0x86, 0xfe, 0x86, 0x86, 0x86, 0x10, 0x10,
        0x10, 0x10, 0x10, 0x10, 0x18, 0x18, 0x18, 0x48, 0x48, 0x78, 0x9c, 0x90,
        0xb0, 0xc0, 0xb0, 0x9c, 0x80, 0x80, 0xc0, 0xc0, 0xc0, 0xfe, 0xee, 0x92,
        0x92, 0x86, 0x86, 0x86, 0xfe, 0x82, 0x86, 0x86, 0x86, 0x86, 0x7c, 0x82,
        0x86, 0x86, 0x86, 0x7c, 0xfe, 0x82, 0xfe, 0xc0, 0xc0, 0xc0, 0x7c, 0x82,
        0xc2, 0xca, 0xc4, 0x7a, 0xfe, 0x86, 0xfe, 0x90, 0x9c, 0x84, 0xfe, 0xc0,
        0xfe, 0x02, 0x02, 0xfe, 0xfe, 0x10, 0x30, 0x30, 0x30, 0x30, 0x82, 0x82,
        0xc2, 0xc2, 0xc2, 0xfe, 0x82, 0x82, 0x82, 0xee, 0x38, 0x10, 0x86, 0x86,
        0x96, 0x92, 0x92, 0xee, 0x82, 0x44, 0x38, 0x38, 0x44, 0x82, 0x82, 0x82,
        0xfe, 0x30, 0x30, 0x30, 0xfe, 0x02, 0x1e, 0xf0, 0x80, 0xfe, 0x00, 0x00,
        0x00, 0x00, 0x06, 0x06, 0x00, 0x00, 0x00, 0x60, 0x60, 0xc0, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x7c, 0xc6,
        0x0c, 0x18, 0x00, 0x18, 0x00, 0x00, 0xfe, 0xfe, 0x00, 0x00, 0xfe, 0x82,
        0x86, 0x86, 0x86, 0xfe, 0x08, 0x08, 0x08, 0x18, 0x18, 0x18, 0xfe, 0x02,
        0xfe, 0xc0, 0xc0, 0xfe, 0xfe, 0x02, 0x1e, 0x06, 0x06, 0xfe, 0x84, 0xc4,
        0xc4, 0xfe, 0x04, 0x04, 0xfe, 0x80, 0xfe, 0x06, 0x06, 0xfe, 0xc0, 0xc0,
        0xc0, 0xfe, 0x82, 0xfe, 0xfe, 0x02, 0x02, 0x06, 0x06, 0x06, 0x7c, 0x44,
        0xfe, 0x86, 0x86, 0xfe, 0xfe, 0x82, 0xfe, 0x06, 0x06, 0x06, 0x44, 0xfe,
        0x44, 0x44, 0xfe, 0x44, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0x6c,
        0x5a, 0x00, 0x0c, 0x18, 0xa8, 0x30, 0x4e, 0x7e, 0x00, 0x12, 0x18, 0x66,
        0x6c, 0xa8, 0x5a, 0x66, 0x54, 0x24, 0x66, 0x00, 0x48, 0x48, 0x18, 0x12,
        0xa8, 0x06, 0x90, 0xa8, 0x12, 0x00, 0x7e, 0x30, 0x12, 0xa8, 0x84, 0x30,
        0x4e, 0x72, 0x18, 0x66, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0x90, 0x54,
        0x78, 0xa8, 0x48, 0x78, 0x6c, 0x72, 0xa8, 0x12, 0x18, 0x6c, 0x72, 0x66,
        0x54, 0x90, 0xa8, 0x72, 0x2a, 0x18, 0xa8, 0x30, 0x4e, 0x7e, 0x00, 0x12,
        0x18, 0x66, 0x6c, 0xa8, 0x72, 0x54, 0xa8, 0x5a, 0x66, 0x18, 0x7e, 0x18,
        0x4e, 0x72, 0xa8, 0x72, 0x2a, 0x18, 0x30, 0x66, 0xa8, 0x30, 0x4e, 0x7e,
        0x00, 0x6c, 0x30, 0x54, 0x4e, 0x9c, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8,
        0xa8, 0x48, 0x54, 0x7e, 0x18, 0xa8, 0x90, 0x54, 0x78, 0x66, 0xa8, 0x6c,
        0x2a, 0x30, 0x5a, 0xa8, 0x84, 0x30, 0x72, 0x2a, 0xa8, 0xd8, 0xa8, 0x00,
        0x4e, 0x12, 0xa8, 0xe4, 0xa2, 0xa8, 0x00, 0x4e, 0x12, 0xa8, 0x6c, 0x2a,
        0x54, 0x54, 0x72, 0xa8, 0x84, 0x30, 0x72, 0x2a, 0xa8, 0xde, 0x9c, 0xa8,
        0x72, 0x2a, 0x18, 0xa8, 0x0c, 0x54, 0x48, 0x5a, 0x78, 0x72, 0x18, 0x66,
        0xa8, 0x66, 0x18, 0x5a, 0x54, 0x66, 0x72, 0x6c, 0xa8, 0x72, 0x2a, 0x00,
        0x72, 0xa8, 0x72, 0x2a, 0x18, 0xa8, 0x30, 0x4e, 0x7e, 0x00, 0x12, 0x18,
        0x66, 0x6c, 0xa8, 0x00, 0x66, 0x18, 0xa8, 0x30, 0x4e, 0x0c, 0x66, 0x18,
        0x00, 0x6c, 0x30, 0x4e, 0x24, 0xa8, 0x72, 0x2a, 0x18, 0x30, 0x66, 0xa8,
        0x1e, 0x54, 0x66, 0x0c, 0x18, 0x9c, 0xa8, 0x24, 0x54, 0x54, 0x12, 0xa8,
        0x42, 0x78, 0x0c, 0x3c, 0xa8, 0xae, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8, 0xa8,
        0xa8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00
    );

    var IBM_Logo = new Array(
        0x00, 0xe0, 0xa2, 0x2a, 0x60, 0x0c, 0x61, 0x08, 0xd0, 0x1f, 0x70, 0x09,
        0xa2, 0x39, 0xd0, 0x1f, 0xa2, 0x48, 0x70, 0x08, 0xd0, 0x1f, 0x70, 0x04,
        0xa2, 0x57, 0xd0, 0x1f, 0x70, 0x08, 0xa2, 0x66, 0xd0, 0x1f, 0x70, 0x08,
        0xa2, 0x75, 0xd0, 0x1f, 0x12, 0x28, 0xff, 0x00, 0xff, 0x00, 0x3c, 0x00,
        0x3c, 0x00, 0x3c, 0x00, 0x3c, 0x00, 0xff, 0x00, 0xff, 0xff, 0x00, 0xff,
        0x00, 0x38, 0x00, 0x3f, 0x00, 0x3f, 0x00, 0x38, 0x00, 0xff, 0x00, 0xff,
        0x80, 0x00, 0xe0, 0x00, 0xe0, 0x00, 0x80, 0x00, 0x80, 0x00, 0xe0, 0x00,
        0xe0, 0x00, 0x80, 0xf8, 0x00, 0xfc, 0x00, 0x3e, 0x00, 0x3f, 0x00, 0x3b,
        0x00, 0x39, 0x00, 0xf8, 0x00, 0xf8, 0x03, 0x00, 0x07, 0x00, 0x0f, 0x00,
        0xbf, 0x00, 0xfb, 0x00, 0xf3, 0x00, 0xe3, 0x00, 0x43, 0xe0, 0x00, 0xe0,
        0x00, 0x80, 0x00, 0x80, 0x00, 0x80, 0x00, 0x80, 0x00, 0xe0, 0x00, 0xe0
    );
}

var chip8_loop = function () {

}

var drawGfx = function( gfx ) {
    var width = 64*5,
        height = 32*5,
        canvas = document.getElementById('c'),
        context = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    //context.FillStyle = '#000000';
    //context.rect(0, 0, width, height);
    //context.closePath();
    //context.fill();
    context.FillStyle = '#FFFFFF';
    for(var y = 0; y < 32; y += 1) {
        for(var x = 0; x < 64; x+=1) {
            if(gfx[x + (y*64)] === 1 ) {
                context.fillRect(x * 5, y * 5, 5, 5);
            }
        }
    }
//    image = context.getImageData(0, 0, width, height);
//    var imageData = image.data;

//    for(var y = 0; y < 64; y += 1) {
//        for(var x = 0; x < 32; x += 1) {
//            if(gfx[x+(y*64)] === 1 ) {
//                imageData[4*(x+(y * 64)) + 0] = 0xFF;
//                imageData[4*(x+(y * 64)) + 1] = 0xFF;
//                imageData[4*(x+(y * 64)) + 3] = 0xFF;
//                imageData[4*(x+(y * 64)) + 4] = 0xFF;
//            }
 //       }
  //  }
//    image.data = imageData;
//    context.putImageData(image, 0, 0);
}
                    
var start = function () {


    chip8.initialize();
    chip8.loadGame();
    for(var i = 0 ;i < 10000000   ; i+=1 ) {
        chip8.emulateCycle();
        if(chip8.drawFlag) {
            drawGfx(chip8.gfx);
            chip8.drawFlag = false;
        }
        //chip8.setKeys();
    }
}
window.onload = start();
    
//var width = 64,
//    height = 32,
//    c = document.getElementById('c'),
//    ctx = c.getContext('2d'),
//    gLoop;

//c.width = width;
//c.height = height;


//var GameLoop = function() {
//    clear();
//    MoveCircles(5);
//    DrawCircles();
//    gLoop = setTimeout(GameLoop, 1000 / 50);
//}

//GameLoop();


