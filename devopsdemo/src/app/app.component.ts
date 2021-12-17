import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
 
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
 
  url: string = 'http://localhost:8080/webapi/messages';
  msg: string = '';
  fetched_msg:any = '';
  
  // Function to send the message
  send_msg()
  {
    let data = {
      "author": "Ananddddd",
      "created": "2021-05-14T07:33:19.084Z[UTC]",
      "id": 3
     };
    Object.assign(data, {message: this.msg});
    console.log(data);
    this.http.post(this.url, data).subscribe(res => {
    alert("Data Sent");
    });
  }
  
  // Function to get the message
  async get_msg()
  {
    let temp_data = await this.http.get(this.url).toPromise().then();
    // this.fetched_msg = temp_data.valueOf();
    let n = Object.keys(temp_data).length;
    let temp_data1 = await this.http.get(this.url+"/"+n).toPromise().then();
    this.fetched_msg = temp_data1;
    console.log(temp_data1);
    console.log(temp_data);
    
  }
 
  constructor(private http: HttpClient){}
}
