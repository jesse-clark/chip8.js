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
        for( var i = 0; i < Pong.length; i += 1 ) {
            this.memory[i + 512] = Pong[i];
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
                var xd = (this.opcode & 0x0F00) >> 8;
                var yd = (this.opcode & 0x00F0) >> 4;
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

}

var chip8_loop = function () {

}

var drawGfx = function( gfx ) {
    var width = 64,
        height = 32,
        canvas = document.getElementById('c'),
        context = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    context.FillStyle = '#000000';
    context.rect(0, 0, width, height);
    context.closePath();
    context.fill();

    image = context.getImageData(0, 0, width, height);
    var imageData = image.data;

    for(var y = 0; y < 64; y += 1) {
        for(var x = 0; x < 32; x += 1) {
            if(gfx[x+(y*64)] === 1 ) {
                imageData[4*(x+(y * 64)) + 0] = 0xFF;
                imageData[4*(x+(y * 64)) + 1] = 0xFF;
                imageData[4*(x+(y * 64)) + 3] = 0xFF;
                imageData[4*(x+(y * 64)) + 4] = 0xFF;
            }
        }
    }
    image.data = imageData;
    context.putImageData(image, 0, 0);
}
                    
var start = function () {


    chip8.initialize();
    chip8.loadGame();
    for(var i = 0 ; i < 1000  ; i += 1) {
        chip8.emulateCycle();
        if(chip8.drawFlag) {
            drawGfx(chip8.gfx);
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


